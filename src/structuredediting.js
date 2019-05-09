/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import Widget from '@ckeditor/ckeditor5-widget/src/widget';

import DomConverter from '@ckeditor/ckeditor5-engine/src/view/domconverter';

// TODO let's move toWidget() to Widget.
import { toWidget, toWidgetEditable, viewToModelPositionOutsideModelElement } from '@ckeditor/ckeditor5-widget/src/utils';

import { insertElement } from '@ckeditor/ckeditor5-engine/src/conversion/downcasthelpers';

import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';

import imageIcon from '@ckeditor/ckeditor5-core/theme/icons/image.svg';
import mediaIcon from '@ckeditor/ckeditor5-media-embed/theme/icons/media.svg';

import diffToChanges from '@ckeditor/ckeditor5-utils/src/difftochanges';
import diff from '@ckeditor/ckeditor5-utils/src/diff';

// import { stringify } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';

export default class StructuredEditing extends Plugin {
	static get requires() {
		return [ Widget ];
	}

	static get pluginName() {
		return 'StructuredEditing';
	}

	init() {
		this._componentDefinitions = this.editor.config.get( 'component.definitions' );

		this._setSchema();
		this._setConverters();
		this._setMapping();
		this._setDataPipeline();
		this._setSelectionObserver();
		this._createButtons();

		// TODO we should be listening for editor.data#ready, but #1732.
		this.editor.on( 'ready', () => {
			this._setContentObserver();
		} );
	}

	_setSchema() {
		const schema = this.editor.model.schema;

		schema.register( 'objectBlock', {
			isObject: true,
			allowAttributes: [ 'blockName', 'blockProperties', 'blockUid' ],

			// TODO see below.
			allowIn: '$root'
		} );

		schema.register( 'textBlock', {
			allowAttributes: [ 'blockName', 'blockProperties', 'blockUid' ],
			allowContentOf: '$root',

			// Theoretically, this shouldn't be needed but without this
			// it's impossible to place the selection in a textBlock,
			// when there's also a objectBlock next to it.
			// TODO this is weird – check it.
			allowIn: '$root'
		} );

		schema.register( 'blockEditable', {
			isLimit: true,
			allowIn: 'objectBlock',
			allowAttributes: [ 'editableName' ],

			// TODO disallow textBlock and objectBlock in blockEditable.
			allowContentOf: '$root'
		} );

		// Allow block and textBlock elements only directly in root.
		schema.addChildCheck( ( context, childDefinition ) => {
			if ( childDefinition.name == 'objectBlock' || childDefinition.name == 'textBlock' ) {
				return context.endsWith( '$root' ) || context.endsWith( '$clipboardHolder' );
			}
		} );
	}

	_setConverters() {
		const editor = this.editor;
		const conversion = editor.conversion;
		const that = this;

		// objectBlock --------------------------------------------------------------

		conversion.for( 'editingDowncast' ).elementToElement( {
			model: 'objectBlock',
			view: createViewObjectBlock
		} );

		// Handle re-rendering on properties change.
		editor.conversion.for( 'editingDowncast' ).add(
			dispatcher => {
				dispatcher.on( 'attribute:blockProperties:objectBlock', ( evt, data, conversionApi ) => {
					// Hack. Since elementToElement doesn't consume attributes of this element
					// and since there's no way to make it do so without rewriting it all to a plain `insert:*` listener,
					// this is the best way to handle the change of this attribute. Without that this listener
					// would be called also on objectBlock insertion.
					if ( !data.attributeOldValue ) {
						return;
					}

					const viewElement = conversionApi.mapper.toViewElement( data.item );
					const viewEditableSlots = findViewEditableSlots( conversionApi.writer.createRangeIn( viewElement ) );

					conversionApi.writer.remove( viewElement );
					conversionApi.mapper.unbindViewElement( viewElement );

					const newViewElement = createViewObjectBlock( data.item, conversionApi.writer );
					const newViewEditableSlots = findViewEditableSlots( conversionApi.writer.createRangeIn( newViewElement ) );

					for ( const editableName of Object.keys( viewEditableSlots ) ) {
						conversionApi.writer.move(
							conversionApi.writer.createRangeIn( viewEditableSlots[ editableName ] ),
							conversionApi.writer.createPositionAt( newViewEditableSlots[ editableName ], 0 )
						);
					}

					const viewPosition = conversionApi.mapper.toViewPosition( data.range.start );

					conversionApi.mapper.bindElements( data.item, newViewElement );
					conversionApi.writer.insert( viewPosition, newViewElement );
				} );
			}
		);

		function createViewObjectBlock( modelElement, viewWriter ) {
			// TODO duplicated in the converted for textBlock.
			const templateViewElement = cloneViewElement(
				that._renderBlock( modelElement.getAttribute( 'blockName' ), modelElement.getAttribute( 'blockProperties' ) ),
				viewWriter,
				{ createEditables: true }
			);

			viewWriter.setCustomProperty( 'objectBlock', true, templateViewElement );

			const viewEditableSlots = findViewEditableSlots( viewWriter.createRangeIn( templateViewElement ) );
			const modelEditableSlots = findObjectBlockModelEditableSlots( modelElement );

			if ( Object.keys( viewEditableSlots ).sort().join( ',' ) != Object.keys( modelEditableSlots ).sort().join( ',' ) ) {
				throw new Error( 'Different set of editables in the template and in the model.' );
			}

			for ( const editableName of Object.keys( viewEditableSlots ) ) {
				editor.editing.mapper.bindElements( modelEditableSlots[ editableName ], viewEditableSlots[ editableName ] );

				toWidgetEditable( viewEditableSlots[ editableName ], viewWriter );
			}

			return toWidget( templateViewElement, viewWriter );
		}

		conversion.for( 'dataDowncast' ).elementToElement( {
			model: 'objectBlock',
			view: ( modelElement, viewWriter ) => {
				const blockName = modelElement.getAttribute( 'blockName' );
				const blockProperties = modelElement.getAttribute( 'blockProperties' );
				const blockUid = modelElement.getAttribute( 'blockUid' );

				const wrapperViewElement = viewWriter.createContainerElement( 'ck-objectblock', {
					'data-component-name': blockName,
					'data-component-properties': JSON.stringify( blockProperties ),
					'data-component-uid': blockUid
				} );

				const templateViewElement = cloneViewElement(
					this._renderBlock( blockName, blockProperties ),
					viewWriter
				);

				const viewEditableSlots = findViewEditableSlots( viewWriter.createRangeIn( templateViewElement ) );
				const modelEditableSlots = findObjectBlockModelEditableSlots( modelElement );

				if ( Object.keys( viewEditableSlots ).sort().join( ',' ) != Object.keys( modelEditableSlots ).sort().join( ',' ) ) {
					throw new Error( 'Different set of editables in the template and in the model.' );
				}

				for ( const editableName of Object.keys( viewEditableSlots ) ) {
					editor.data.mapper.bindElements( modelEditableSlots[ editableName ], viewEditableSlots[ editableName ] );
				}

				viewWriter.insert( viewWriter.createPositionAt( wrapperViewElement, 0 ), templateViewElement );

				return wrapperViewElement;
			}
		} );

		editor.data.upcastDispatcher.on(
			'element:ck-objectblock',
			prepareObjectBlockUpcastConverter( editor.model, editor.editing.view, editor.data )
		);

		// textBlock ----------------------------------------------------------

		editor.conversion.for( 'editingDowncast' ).add(
			dispatcher => {
				const insertViewElement = insertElement( ( modelElement, viewWriter ) => {
					const templateViewElement = cloneViewElement(
						this._renderBlock( modelElement.getAttribute( 'blockName' ), modelElement.getAttribute( 'blockProperties' ) ),
						viewWriter
					);

					viewWriter.setCustomProperty( 'textBlock', true, templateViewElement );

					return templateViewElement;
				} );

				dispatcher.on( 'insert:textBlock', ( evt, data, conversionApi ) => {
					insertViewElement( evt, data, conversionApi );

					// Use the existing "old" mapping created by `insertViewElement()`.
					const templateViewElement = conversionApi.mapper.toViewElement( data.item );
					const viewEditableSlot = findViewEditableSlots( conversionApi.writer.createRangeIn( templateViewElement ) ).main;

					if ( !viewEditableSlot ) {
						throw new Error( 'Text block\'s template does not contain the main editable.' );
					}

					conversionApi.mapper.bindElements( data.item, viewEditableSlot );
				} );
			}
		);

		editor.conversion.for( 'dataDowncast' ).add(
			dispatcher => {
				const insertViewElement = insertElement( ( modelElement, viewWriter ) => {
					const blockName = modelElement.getAttribute( 'blockName' );
					const blockProperties = modelElement.getAttribute( 'blockProperties' );
					const blockUid = modelElement.getAttribute( 'blockUid' );

					const wrapperViewElement = viewWriter.createContainerElement( 'ck-textblock', {
						'data-component-name': blockName,
						'data-component-properties': JSON.stringify( blockProperties ),
						'data-component-uid': blockUid
					} );

					const templateViewElement = cloneViewElement(
						this._renderBlock( blockName, blockProperties ),
						viewWriter
					);

					viewWriter.insert( viewWriter.createPositionAt( wrapperViewElement, 0 ), templateViewElement );

					return wrapperViewElement;
				} );

				dispatcher.on( 'insert:textBlock', ( evt, data, conversionApi ) => {
					insertViewElement( evt, data, conversionApi );

					// Use the existing "old" mapping created by `insertViewElement()`.
					const wrapperViewElement = conversionApi.mapper.toViewElement( data.item );
					const viewEditableSlot = findViewEditableSlots( conversionApi.writer.createRangeIn( wrapperViewElement ) ).main;

					if ( !viewEditableSlot ) {
						throw new Error( 'Text block\'s template does not contain the main editable.' );
					}

					conversionApi.mapper.bindElements( data.item, viewEditableSlot );
				} );
			}
		);

		editor.data.upcastDispatcher.on( 'element:ck-textblock', prepareTextBlockUpcastConverter( editor.model ) );
	}

	// We have many more elements in the view than in the model, so we need to
	// make sure that every position in the view maps to something in the model,
	// and vice versa.
	_setMapping() {
		this.editor.editing.mapper.on(
			'viewToModelPosition',
			viewToModelPositionOutsideModelElement( this.editor.model, viewElement => viewElement.getCustomProperty( 'objectBlock' ) )
		);
	}

	// TODO
	// firing the insert/remove/update events like this, with all the data, is completely non-optimal.
	_setContentObserver() {
		const editor = this.editor;
		const doc = editor.model.document;
		let previousItems = Array.from( doc.getRoot().getChildren() );

		doc.registerPostFixer( writer => {
			if ( !didRootContentChange( doc ) ) {
				return;
			}

			// Wraps root content in textBlocks.
			// TODO Merges subsequent blocks of the base text type.
			for ( const node of doc.getRoot().getChildren() ) {
				if ( !node.is( 'objectBlock' ) && !node.is( 'textBlock' ) ) {
					const textBlock = textBlockToModelElement(
						this._componentDefinitions.getDefinition( { name: 'Text' } ), writer, editor.data );

					writer.remove( writer.createRangeIn( textBlock ) );

					writer.wrap( writer.createRangeOn( node ), textBlock );
				}
			}

			// Sets new uids for new nodes (TODO potentially this must be done by the external service).
			// Fires change events.
			const newItems = Array.from( doc.getRoot().getChildren() );
			const changes = diffToChanges( diff( previousItems, newItems ), newItems );

			for ( const change of changes ) {
				if ( change.type == 'insert' ) {
					for ( const block of change.values ) {
						// There are two places where uids are generated for new items.
						// Here, and in the `getDefinition()` call.
						writer.setAttribute( 'blockUid', uid(), block );
					}

					this.fire( 'insert', {
						index: change.index,
						blocks: change.values.map( block => modelElementToBlock( block, editor.data ) )
					} );
				} else {
					this.fire( 'remove', {
						index: change.index,
						howMany: change.howMany
					} );
				}
			}

			previousItems = newItems;
		} );

		doc.on( 'change:data', () => {
			const changedBlocks = new Set();

			for ( const change of doc.differ.getChanges() ) {
				if ( change.type == 'remove' || change.type == 'insert' ) {
					const block = findBlockAncestor( change.position.parent );

					if ( block ) {
						changedBlocks.add( block );
					}
				} else {
					for ( const item of change.range.getItems() ) {
						const block = isBlock( item ) ? item : findBlockAncestor( item );

						if ( block ) {
							changedBlocks.add( block );
						}
					}
				}
			}

			for ( const block of changedBlocks ) {
				this.fire( 'update', modelElementToBlock( block, editor.data ) );
			}
		} );
	}

	_setSelectionObserver() {
		const editor = this.editor;
		const selection = editor.model.document.selection;

		let previousBlock;

		editor.model.document.on( 'change', () => {
			const newBlock = selection.getSelectedElement() || findBlockAncestor( selection.getFirstPosition().parent );

			if ( newBlock != previousBlock ) {
				this.fire( 'select', newBlock && newBlock.getAttribute( 'blockUid' ) );

				previousBlock = newBlock;
			}
		} );
	}

	_setDataPipeline() {
		const editor = this.editor;
		const repository = this._componentDefinitions;

		editor.data.init = function( allRootsData ) {
			if ( typeof allRootsData != 'object' || !Array.isArray( allRootsData.main ) ) {
				throw new Error( 'Wrong data format.' );
			}

			const data = allRootsData.main;

			editor.model.enqueueChange( 'transparent', writer => {
				const modelRoot = this.model.document.getRoot();
				const dataDocFrag = writer.createDocumentFragment();

				for ( const blockData of data ) {
					const node = blockToModelElement( repository.getDefinition( blockData ), writer, editor.data );

					writer.append( node, dataDocFrag );
				}

				writer.insert( dataDocFrag, modelRoot, 0 );
			} );
		};
	}

	_createButtons() {
		const editor = this.editor;
		const repository = this._componentDefinitions;

		for ( const blockName of repository.getNames() ) {
			editor.ui.componentFactory.add( 'insert' + blockName, () => {
				const button = new ButtonView( editor.locale );

				button.withText = blockName == 'Text' || blockName == 'Headline';
				button.label = blockName;
				button.icon = { Image: imageIcon, Video: mediaIcon }[ blockName ];

				button.on( 'execute', () => {
					editor.model.change( writer => {
						const emptyDefinition = repository.getDefinition( { name: blockName } );
						const modelElement = blockToModelElement( emptyDefinition, writer, editor.data );

						editor.model.insertContent( modelElement );
					} );
				} );

				return button;
			} );
		}
	}

	_renderBlock( blockName, blockProperties ) {
		return new DomConverter().domToView( this._componentDefinitions.render( blockName, blockProperties ) );
	}
}

function blockToModelElement( blockData, writer, dataController ) {
	if ( blockData.type == 'objectBlock' ) {
		return objectBlockToModelElement( blockData, writer, dataController );
	}

	if ( blockData.type == 'textBlock' ) {
		return textBlockToModelElement( blockData, writer, dataController );
	}

	throw new Error( `Wrong block type: "${ blockData.type }".` );
}

function objectBlockToModelElement( blockData, writer, dataController ) {
	const block = writer.createElement( 'objectBlock', {
		blockName: blockData.name,
		blockProperties: Object.assign( {}, blockData.properties ),
		blockUid: blockData.uid
	} );

	for ( const editableName of Object.keys( blockData.editables ) ) {
		const editableDocFrag = dataController.parse( blockData.editables[ editableName ], 'blockEditable' );

		// Ideally, every editable should have different element name so we can configure schema differently for them.
		const editableContainer = writer.createElement( 'blockEditable', { editableName } );

		writer.append( editableDocFrag, editableContainer );
		writer.append( editableContainer, block );
	}

	return block;
}

function textBlockToModelElement( blockData, writer, dataController ) {
	const editableDocFrag = dataController.parse( blockData.editables.main, 'textBlock' );

	const block = writer.createElement( 'textBlock', {
		blockName: blockData.name,
		blockProperties: Object.assign( {}, blockData.properties ),
		blockUid: blockData.uid
	} );

	writer.append( editableDocFrag, block );

	return block;
}

function modelElementToBlock( block, dataController ) {
	const editables = {};

	if ( block.is( 'textBlock' ) ) {
		editables.main = dataController.stringify( block );
	} else {
		for ( const editable of block.getChildren() ) {
			editables[ editable.getAttribute( 'editableName' ) ] = dataController.stringify( editable );
		}
	}

	return {
		name: block.getAttribute( 'blockName' ),
		properties: block.getAttribute( 'blockProperties' ),
		uid: block.getAttribute( 'blockUid' ),
		editables
	};
}

/**
 * @param element
 * @param writer
 * @param {Object} opts
 * @param {Boolean} opts.createEditables
 */
function cloneViewElement( element, writer, opts = {} ) {
	let clone;

	if ( opts.createEditables && element.getAttribute( 'data-component-editable' ) ) {
		clone = writer.createEditableElement( element.name, element.getAttributes() );
	} else {
		clone = writer.createContainerElement( element.name, element.getAttributes() );
	}

	for ( const child of element.getChildren() ) {
		writer.insert( writer.createPositionAt( clone, 'end' ), cloneViewNode( child, writer, opts ) );
	}

	return clone;
}

function cloneViewNode( node, writer, opts ) {
	if ( node.is( 'element' ) ) {
		return cloneViewElement( node, writer, opts );
	} else {
		return writer.createText( node.data );
	}
}

/**
 * @param {module:engine/view/range~Range}
 */
function findViewEditableSlots( range ) {
	const editables = {};

	for ( const value of range ) {
		if ( value.type == 'elementStart' && value.item.getAttribute( 'data-component-editable' ) ) {
			editables[ value.item.getAttribute( 'data-component-editable' ) ] = value.item;
		}
	}

	return editables;
}

/**
 * @param {module:engine/model/element~Element} parent
 */
function findObjectBlockModelEditableSlots( parent ) {
	const editables = {};

	for ( const child of parent.getChildren() ) {
		if ( child.getAttribute( 'editableName' ) ) {
			editables[ child.getAttribute( 'editableName' ) ] = child;
		} else {
			throw new Error( 'objectBlock must contain only editables.' );
		}
	}

	return editables;
}

// Copy paste from upcasthelpers, but with two changes:
//
// * it doesn't convert the view element children,
// * instead, it converts only the content of editables.
//
// TODO this shouldn't be that hard: https://github.com/ckeditor/ckeditor5-engine/issues/1728
function prepareObjectBlockUpcastConverter( model, view ) {
	return ( evt, data, conversionApi ) => {
		// When element was already consumed then skip it.
		if ( !conversionApi.consumable.test( data.viewItem, { name: true } ) ) {
			return;
		}

		const modelElement = conversionApi.writer.createElement( 'objectBlock', {
			blockName: data.viewItem.getAttribute( 'data-component-name' ),
			blockProperties: JSON.parse( data.viewItem.getAttribute( 'data-component-properties' ) ),
			blockUid: data.viewItem.getAttribute( 'data-component-uid' )
		} );

		const viewEditableSlots = findViewEditableSlots( view.createRangeIn( data.viewItem.getChild( 0 ) ) );

		for ( const editableName of Object.keys( viewEditableSlots ) ) {
			// Ideally, every editable should have different element name so we can configure schema differently for them.
			const editableContainer = conversionApi.writer.createElement( 'blockEditable', { editableName } );

			conversionApi.writer.append( editableContainer, modelElement );

			conversionApi.convertChildren(
				viewEditableSlots[ editableName ],
				conversionApi.writer.createPositionAt( editableContainer, 0 )
			);
		}

		// Find allowed parent for element that we are going to insert.
		// If current parent does not allow to insert element but one of the ancestors does
		// then split nodes to allowed parent.
		const splitResult = conversionApi.splitToAllowedParent( modelElement, data.modelCursor );

		// When there is no split result it means that we can't insert element to model tree, so let's skip it.
		if ( !splitResult ) {
			return;
		}

		// Insert element on allowed position.
		conversionApi.writer.insert( modelElement, splitResult.position );

		// Consume appropriate value from consumable values list.
		conversionApi.consumable.consume( data.viewItem, { name: true } );

		const parts = conversionApi.getSplitParts( modelElement );

		// Set conversion result range.
		data.modelRange = model.createRange(
			conversionApi.writer.createPositionBefore( modelElement ),
			conversionApi.writer.createPositionAfter( parts[ parts.length - 1 ] )
		);

		// Now we need to check where the `modelCursor` should be.
		if ( splitResult.cursorParent ) {
			// If we split parent to insert our element then we want to continue conversion in the new part of the split parent.
			//
			// before: <allowed><notAllowed>foo[]</notAllowed></allowed>
			// after:  <allowed><notAllowed>foo</notAllowed><converted></converted><notAllowed>[]</notAllowed></allowed>

			data.modelCursor = conversionApi.writer.createPositionAt( splitResult.cursorParent, 0 );
		} else {
			// Otherwise just continue after inserted element.

			data.modelCursor = data.modelRange.end;
		}
	};
}

// TODO it seems that it can be a normal converter now.
function prepareTextBlockUpcastConverter( model ) {
	return ( evt, data, conversionApi ) => {
		// When element was already consumed then skip it.
		if ( !conversionApi.consumable.test( data.viewItem, { name: true } ) ) {
			return;
		}

		const modelElement = conversionApi.writer.createElement( 'textBlock', {
			blockName: data.viewItem.getAttribute( 'data-component-name' ),
			blockProperties: JSON.parse( data.viewItem.getAttribute( 'data-component-properties' ) ),
			blockUid: data.viewItem.getAttribute( 'data-component-uid' )
		} );

		// Find allowed parent for element that we are going to insert.
		// If current parent does not allow to insert element but one of the ancestors does
		// then split nodes to allowed parent.
		const splitResult = conversionApi.splitToAllowedParent( modelElement, data.modelCursor );

		// When there is no split result it means that we can't insert element to model tree, so let's skip it.
		if ( !splitResult ) {
			return;
		}

		// Insert element on allowed position.
		conversionApi.writer.insert( modelElement, splitResult.position );

		// Convert children and insert to element.
		conversionApi.convertChildren( data.viewItem, conversionApi.writer.createPositionAt( modelElement, 0 ) );

		// Consume appropriate value from consumable values list.
		conversionApi.consumable.consume( data.viewItem, { name: true } );

		const parts = conversionApi.getSplitParts( modelElement );

		// Set conversion result range.
		data.modelRange = model.createRange(
			conversionApi.writer.createPositionBefore( modelElement ),
			conversionApi.writer.createPositionAfter( parts[ parts.length - 1 ] )
		);

		// Now we need to check where the `modelCursor` should be.
		if ( splitResult.cursorParent ) {
			// If we split parent to insert our element then we want to continue conversion in the new part of the split parent.
			//
			// before: <allowed><notAllowed>foo[]</notAllowed></allowed>
			// after:  <allowed><notAllowed>foo</notAllowed><converted></converted><notAllowed>[]</notAllowed></allowed>

			data.modelCursor = conversionApi.writer.createPositionAt( splitResult.cursorParent, 0 );
		} else {
			// Otherwise just continue after inserted element.

			data.modelCursor = data.modelRange.end;
		}
	};
}

function didRootContentChange( doc ) {
	for ( const change of doc.differ.getChanges() ) {
		if ( ( change.type == 'insert' || change.type == 'remove' ) && change.position.parent.rootName == 'main' ) {
			return true;
		}
	}

	return false;
}

function findBlockAncestor( element ) {
	return element.getAncestors( { includeSelf: true } ).find( element => isBlock( element ) );
}

function isBlock( element ) {
	return element.is( 'textBlock' ) || element.is( 'objectBlock' );
}

function uid() {
	return Math.floor( Math.random() * 9e4 );
}
