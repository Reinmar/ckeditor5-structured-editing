/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* global DOMParser, document, console */

import { throttle } from 'lodash';

export default class InstanceCollection {
	constructor( initialData ) {
		this._data = initialData;
		this._modifiedInstances = [];

		// TODO hack for incorrect init order (selection is changed before we start to observe the editor).
		this._selectedInstanceUid = initialData[ 0 ].uid;
	}

	getData() {
		return this._data;
	}

	getInstanceByUid( uid ) {
		return this._data.find( instance => instance.uid === uid );
	}

	setInstanceProperty( uid, propName, propValue ) {
		const element = Array
			.from( this.editor.model.document.getRoot().getChildren() )
			.find( child => child.getAttribute( 'blockUid' ) === uid );

		this.editor.model.change( writer => {
			const properties = element.getAttribute( 'blockProperties' );
			const newProperties = Object.assign( {}, properties, { [ propName ]: propValue } );

			writer.setAttribute( 'blockProperties', newProperties, element );
		} );
	}

	renderTo( container ) {
		this._container = container;

		this._render();
	}

	observe( editor ) {
		this.editor = editor;

		const structuredEditingPlugin = editor.plugins.get( 'StructuredEditing' );
		const throttledRender = throttle( () => this._render(), 100, { leading: false } );

		structuredEditingPlugin.on( 'insert', ( evt, change ) => {
			console.log( '#insert', change );

			this._data.splice( change.index, 0, ...change.blocks );

			this._modifiedInstances.push( ...change.blocks.map( block => block.uid ) );

			throttledRender();
		} );

		structuredEditingPlugin.on( 'remove', ( evt, change ) => {
			console.log( '#remove', change );

			this._data.splice( change.index, change.howMany );

			throttledRender();
		} );

		structuredEditingPlugin.on( 'update', ( evt, changedBlock ) => {
			console.log( '#update', changedBlock );

			const index = this._data.findIndex( block => block.uid === changedBlock.uid );

			this._data.splice( index, 1, changedBlock );

			this._modifiedInstances.push( changedBlock.uid );

			throttledRender();
		} );

		structuredEditingPlugin.on( 'select', ( evt, selectedInstanceUid ) => {
			console.log( '#select', selectedInstanceUid );

			this._selectedInstanceUid = selectedInstanceUid;

			this._renderSelection();
		} );
	}

	_render() {
		this._container.innerHTML = '';

		for ( const blockData of this._data ) {
			let html = `
				<li class="console-component" id="console-component-${ blockData.uid }">
				<h2 class="console-component-core-data">
						#${ blockData.uid } ${ blockData.name }
				</h2>
			`;

			if ( blockData.properties && Object.keys( blockData.properties ).length ) {
				html += `
					<div class="console-component-additional-data">
						<h3>properties:</h3>
						${ formatObject( blockData.properties ) }
					</div>
				`;
			}

			if ( blockData.editables && Object.keys( blockData.editables ).length ) {
				html += `
					<div class="console-component-additional-data">
						<h3>editables:</h3>
						${ formatObject( blockData.editables ) }
					</div>
				`;
			}

			const container = d( html );

			this._container.appendChild( container );
		}

		for ( const uid of new Set( this._modifiedInstances ) ) {
			const dataBlock = document.getElementById( `console-component-${ uid }` );

			dataBlock.classList.add( 'console-component-modified' );
		}

		this._modifiedInstances = [];

		this._renderSelection();
	}

	_renderSelection() {
		document
			.querySelectorAll( '.console-component-selected' )
			.forEach( element => element.classList.remove( 'console-component-selected' ) );

		const selectedDataBlock = document.getElementById( `console-component-${ this._selectedInstanceUid }` );

		if ( selectedDataBlock ) {
			selectedDataBlock.classList.add( 'console-component-selected' );
		}
	}
}

const parser = new DOMParser();

function d( htmlString ) {
	const doc = parser.parseFromString( htmlString, 'text/html' );

	return doc.body.firstElementChild;
}

function formatObject( obj ) {
	let html = '';

	for ( const prop of Object.keys( obj ) ) {
		html +=
			`<tr>
				<th class="property-name">${ prop }</th>
				<td class="property-value">${ formatValue( obj[ prop ] ) }</td>
			</tr>`;
	}

	return `<table>${ html }</table>`;
}

function formatValue( value ) {
	if ( typeof value == 'number' ) {
		return value;
	}

	return value.slice( 0, 30 ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' );
}
