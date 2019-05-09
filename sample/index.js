/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* globals console, window, document, DOMParser */

import ClassicEditor from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';

import Essentials from '@ckeditor/ckeditor5-essentials/src/essentials';

import Autoformat from '@ckeditor/ckeditor5-autoformat/src/autoformat';
import BlockQuote from '@ckeditor/ckeditor5-block-quote/src/blockquote';
import Bold from '@ckeditor/ckeditor5-basic-styles/src/bold';
import Heading from '@ckeditor/ckeditor5-heading/src/heading';
import Italic from '@ckeditor/ckeditor5-basic-styles/src/italic';
import Link from '@ckeditor/ckeditor5-link/src/link';
import List from '@ckeditor/ckeditor5-list/src/list';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import Table from '@ckeditor/ckeditor5-table/src/table';
import TableToolbar from '@ckeditor/ckeditor5-table/src/tabletoolbar';

import StructuredEditing from '../src/structuredediting';
import InstanceCollection from '../src/instancecollection';
import InstanceInspector from '../src/instanceinspector';
import MagicBlock from '../src/magicblock';

import CKEditorInspector from '@ckeditor/ckeditor5-inspector';

const sampleText =
	'The framework was designed to be a highly flexible and universal ' +
	'platform for creating custom rich-text editing solutions. ';

const parser = new DOMParser();

function d( htmlString ) {
	const doc = parser.parseFromString( htmlString, 'text/html' );

	if ( doc.body.children.length != 1 ) {
		throw Error( 'Component\'s render() callback must return exactly one element' );
	}

	return doc.body.firstElementChild;
}

function uid() {
	return Math.floor( Math.random() * 9e4 );
}

class ComponentDefinitions {
	constructor( components ) {
		this._components = new Map();

		for ( const componentName of Object.keys( components ) ) {
			this._components.set( componentName, components[ componentName ] );
		}
	}

	render( name, properties ) {
		const componentDefinition = this._get( name );

		return componentDefinition.render( properties );
	}

	getDefinition( data ) {
		const definition = this._get( data.name );

		return {
			name: data.name,
			type: definition.type,
			uid: data.uid || uid(),
			editables: data.editables || definition.editables || {},
			properties: data.properties || {}
		};
	}

	getNames() {
		return Array.from( this._components.keys() );
	}

	_get( name ) {
		if ( !this._components.has( name ) ) {
			throw new Error( `Unknown component name: ${ name }.` );
		}

		return this._components.get( name );
	}
}

const componentCollection = new InstanceCollection( [
	{
		name: 'Headline',
		uid: uid(),
		editables: {
			main: '<h2>Structured editing demo</h2><h3>Reinventing structured content editing</h3>'
		},
		properties: {
			level: 1
		}
	},

	{
		name: 'Text',
		uid: uid(),
		editables: {
			main: `<h3>I'm totally editable</h3><p>${ sampleText.repeat( 2 ) }</p>`
		}
	},

	{
		name: 'Image',
		uid: uid(),
		editables: {
			caption: '<p>A photo of a kitten.</p>'
		},
		properties: {
			url: 'http://placekitten.com/800/300',
			alt: 'Random kitten'
		}
	},

	{
		name: 'Text',
		uid: uid(),
		editables: {
			main: '<h3>I\'m totally editable</h3>' + `<p>${ sampleText.repeat( 2 ) }</p>`.repeat( 3 )
		}
	},

	{
		name: 'Video',
		uid: uid(),
		editables: {
			title: '<h3>Red Hot Chili Peppers - Live at Slane Castle 2003 Full Concert</h3>',
			caption: '<p>Check out Frusciante\'s solo</p>'
		},
		properties: {
			url: 'https://www.youtube.com/embed/FmrGz8qSyrk'
		}
	},

	{
		name: 'Video',
		uid: uid(),
		editables: {
			title: '<h3>Loituma - Ieva\'s polka, Ievan Polkka</h3>',
			caption: '<p>Trololo...</p>'
		},
		properties: {
			url: 'https://www.youtube.com/embed/1ygdAiDxKfI',
		}
	},

	{
		name: 'Text',
		uid: uid(),
		editables: {
			main: `<p>${ sampleText.repeat( 2 ) }</p>`.repeat( 3 )
		}
	},
] );

ClassicEditor
	.create( document.querySelector( '#editor' ), {
		plugins: [
			Essentials,
			Autoformat,
			BlockQuote,
			Bold,
			Heading,
			Italic,
			Link,
			List,
			Paragraph,
			Table,
			TableToolbar,
			StructuredEditing,
			MagicBlock
		],
		toolbar: [
			'heading',
			'|',
			'bold',
			'italic',
			'link',
			'bulletedList',
			'numberedList',
			'|',
			// 'insertdefault',
			// 'insertheadline',
			'insertimage',
			'insertvideo',
			'|',
			'undo',
			'redo'
		],
		table: {
			contentToolbar: [
				'tableColumn',
				'tableRow',
				'mergeTableCells'
			]
		},
		component: {
			definitions: new ComponentDefinitions( {
				Text: {
					type: 'textBlock',
					editables: {
						main: '<p></p>'
					},
					render() {
						return d( `
							<section class="component component-text">
								<div data-component-editable="main"></div>
							</section>
						` );
					}
				},

				Headline: {
					type: 'textBlock',
					editables: {
						main: '<h2></h2>'
					},
					render( properties ) {
						return d( `
							<hgroup class="component component-text component-headline component-headline-${ properties.level || 1 }">
								<div data-component-editable="main"></div>
							</hgroup>
						` );
					}
				},

				// Will be able to work once we'll support inline editables.
				Quote: {
					type: 'textBlock',
					editables: {
						main: ''
					},
					render() {
						return d( `
							<blockquote class="component component-text component-quote">
								<p data-component-editable="main"></p>
							</blockquote>
						` );
					}
				},

				Image: {
					type: 'objectBlock',
					editables: {
						caption: '<p></p>'
					},
					render( properties ) {
						return d( `
							<figure class="component component-object component-image component-align-${ properties.align || 'none' }">
								<img src="${ properties.url || '' }" alt="${ properties.alt || '' }" width="700" height="200">
								<figcaption data-component-editable="caption"></figcaption>
							</figure>
						` );
					}
				},

				Video: {
					type: 'objectBlock',
					editables: {
						title: '<h3></h3>',
						caption: '<p></p>'
					},
					render( properties ) {
						return d( `
							<figure class="component component-object component-video component-align-${ properties.align || 'none' }">
								<div data-component-editable="title"></div>
								<p>${ properties.url || '' }</p>
								<figcaption data-component-editable="caption"></figcaption>
							</figure>
						` );

						// return d( `
						// 	<figure class="component component-object component-video">
						// 		<div data-component-editable="title"></div>
						// 		<iframe width="560" height="315" src="${ properties.url }" frameborder="0"
						// 			allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
						// 		</iframe>
						// 		<figcaption data-component-editable="caption"></figcaption>
						// 	</figure>
						// ` );
					}
				}
			} )
		},
		initialData: {
			main: componentCollection.getData()
		}
	} )
	.then( editor => {
		window.editor = editor;

		componentCollection.observe( editor );
		componentCollection.renderTo( document.getElementById( 'page-structure-container' ) );

		const inspector = new InstanceInspector( editor, componentCollection );

		inspector.renderTo( document.getElementById( 'inspector-container' ) );

		CKEditorInspector.attach( 'editor', editor );
	} )
	.catch( err => {
		console.error( err.stack );
	} );
