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
import ComponentCollection from '../src/componentcollection';
import MagicBlock from '../src/magicblock';

const sampleText = 'Litwo! Ojczyzno moja! ty jesteś jak zdrowie; Ile cię trzeba cenić, ten tylko się dowie, Kto cię stracił. ';

const parser = new DOMParser();

function d( htmlString ) {
	const doc = parser.parseFromString( htmlString, 'text/html' );

	if ( doc.body.children.length != 1 ) {
		throw Error( 'Block\'s render() callback must return exactly one element' );
	}

	return doc.body.firstElementChild;
}

function uid() {
	return Math.floor( Math.random() * 9e4 );
}

class ComponentRepository {
	constructor( blocks ) {
		this._blocks = new Map();

		for ( const blockName of Object.keys( blocks ) ) {
			this._blocks.set( blockName, blocks[ blockName ] );
		}
	}

	render( name, props ) {
		const blockDefinition = this._get( name );

		return blockDefinition.render( props );
	}

	getDefinition( data ) {
		const definition = this._get( data.name );

		return {
			name: data.name,
			type: definition.type,
			uid: data.uid || uid(),
			slot: data.slot || definition.slot,
			slots: data.slots || definition.slots || {},
			props: data.props || {}
		};
	}

	_get( name ) {
		if ( !this._blocks.has( name ) ) {
			throw new Error( 'Unknown block name.' );
		}

		return this._blocks.get( name );
	}
}

const blockCollection = new ComponentCollection( [
	{
		name: 'headline',
		uid: uid(),
		slots: {
			main: '<h2>Blocks demo</h2><h3>Reinventing structured content editing</h3>'
		},
		props: {
			level: 1
		}
	},

	{
		name: 'image',
		uid: uid(),
		slots: {
			heading: '<h3>Random kitten</h3>',
			caption: '<p>A photo of a kitten.</p>'
		},
		props: {
			url: 'http://placekitten.com/700/200',
			alt: 'Random kitten'
		}
	},

	{
		name: 'default',
		uid: uid(),
		slots: {
			main: `<h3>I'm totally editable</h3><p>${ sampleText.repeat( 3 ) }</p>`
		}
	},

	{
		name: 'image',
		uid: uid(),
		slots: {
			heading: '<h3>Another random kitten</h3>',
			caption: '<p>Cause kittens.</p>'
		},
		props: {
			url: 'http://placekitten.com/500/300',
			alt: 'Random kitten 2',
			align: 'right'
		}
	},

	{
		name: 'default',
		uid: uid(),
		slots: {
			main: '<h3>I\'m totally editable</h3>' + `<p>${ sampleText.repeat( 3 ) }</p>`.repeat( 3 )
		}
	},

	{
		name: 'video',
		uid: uid(),
		props: {
			url: 'https://www.youtube.com/embed/FmrGz8qSyrk',
			title: 'Red Hot Chili Peppers - Live at Slane Castle 2003 Full Concert'
		}
	},

	{
		name: 'video',
		uid: uid(),
		props: {
			url: 'https://www.youtube.com/embed/1ygdAiDxKfI',
			title: 'Loituma - Ieva\'s polka, Ievan Polkka'
		}
	},

	{
		name: 'default',
		uid: uid(),
		slots: {
			main: `<p>${ sampleText.repeat( 3 ) }</p>`.repeat( 3 )
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
			'blockQuote',
			'insertTable',
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
		block: {
			repository: new ComponentRepository( {
				default: {
					type: 'textBlock',
					slots: {
						main: '<p></p>'
					},
					render() {
						return d( `
							<section class="block block-text block-default">
								<div class="block-content" data-block-slot=main></div>
							</section>
						` );
					}
				},

				headline: {
					type: 'textBlock',
					slots: {
						main: '<h2></h2>',
					},
					render( props ) {
						return d( `
							<hgroup class="block block-text block-headline block-headline-${ props.level }">
								<div class="block-content" data-block-slot=main></div>
							</hgroup>
						` );
					}
				},

				image: {
					type: 'objectBlock',
					slots: {
						heading: '<h1></h1>',
						caption: '<p></p>'
					},
					render( props ) {
						return d( `
							<div class="block block-object block-image block-image-align-${ props.align || 'default' }">
								<div class="block-content" data-block-slot=heading></div>
								<img src="${ props.url }" alt="${ props.alt }" width="700" height="200">
								<div class="block-content" data-block-slot=caption></div>
							</div>
						` );
					}
				},

				video: {
					type: 'objectBlock',
					render( props ) {
						return d( `
							<div class="block block-object block-video">
								<h3>${ props.title }</h3>
								<p>${ props.url }</p>
							</div>
						` );

						// return d( `
						// 	<div class="block block-object block-video">
						// 		<h3>${ props.title }</h3>
						// 		<iframe width="560" height="315" src="${ props.url }" frameborder="0"
						// 			allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
						// 		</iframe>
						// 	</div>
						// ` );
					}
				}
			} )
		},
		initialData: {
			main: blockCollection.getData()
		}
	} )
	.then( editor => {
		window.editor = editor;

		blockCollection.observe( editor );
		blockCollection.renderTo( document.getElementById( 'page-structure-console' ) );
	} )
	.catch( err => {
		console.error( err.stack );
	} );
