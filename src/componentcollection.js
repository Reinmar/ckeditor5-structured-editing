/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* global DOMParser, document, console */

import { throttle } from 'lodash';

export default class ComponentCollection {
	constructor( initialData ) {
		this._data = initialData;
		this._modifiedInstances = [];

		// TODO hack for incorrect init order (selection is changed before we start to observe the editor).
		this._selectedBlockUid = initialData[ 0 ].uid;
	}

	getData() {
		return this._data;
	}

	renderTo( container ) {
		this._container = container;

		this._render();
	}

	observe( editor ) {
		const structuredEditing = editor.plugins.get( 'StructuredEditing' );
		const throttledRender = throttle( () => this._render(), 100, { leading: false } );

		structuredEditing.on( 'insert', ( evt, change ) => {
			console.log( '#insert', change );

			this._data.splice( change.index, 0, ...change.blocks );

			this._modifiedInstances.push( ...change.blocks.map( block => block.uid ) );

			throttledRender();
		} );

		structuredEditing.on( 'remove', ( evt, change ) => {
			console.log( '#remove', change );

			this._data.splice( change.index, change.howMany );

			throttledRender();
		} );

		structuredEditing.on( 'update', ( evt, changedBlock ) => {
			console.log( '#update', changedBlock );

			const index = this._data.findIndex( block => block.uid === changedBlock.uid );

			this._data.splice( index, 1, changedBlock );

			this._modifiedInstances.push( changedBlock.uid );

			throttledRender();
		} );

		structuredEditing.on( 'select', ( evt, selectedBlockUid ) => {
			console.log( '#select', selectedBlockUid );

			this._selectedBlockUid = selectedBlockUid;

			this._renderSelection();
		} );
	}

	_render() {
		this._container.innerHTML = '';

		for ( const blockData of this._data ) {
			let html = `
				<li class="console-block" id="console-block-${ blockData.uid }">
				<h2 class="console-block-core-data">
						#${ blockData.uid } ${ blockData.name }
				</h2>
			`;

			if ( blockData.props ) {
				html += `
					<div class="console-block-additional-data">
						<h3>props:</h3>
						${ formatObject( blockData.props ) }
					</div>
				`;
			}

			if ( blockData.slots ) {
				html += `
					<div class="console-block-additional-data">
						<h3>slots:</h3>
						${ formatObject( blockData.slots ) }
					</div>
				`;
			}

			const container = d( html );

			this._container.appendChild( container );
		}

		for ( const uid of new Set( this._modifiedInstances ) ) {
			const dataBlock = document.getElementById( `console-block-${ uid }` );

			dataBlock.classList.add( 'console-block-modified' );
		}

		this._modifiedInstances = [];

		this._renderSelection();
	}

	_renderSelection() {
		document
			.querySelectorAll( '.console-block-selected' )
			.forEach( element => element.classList.remove( 'console-block-selected' ) );

		const selectedDataBlock = document.getElementById( `console-block-${ this._selectedBlockUid }` );

		if ( selectedDataBlock ) {
			selectedDataBlock.classList.add( 'console-block-selected' );
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
