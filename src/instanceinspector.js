/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* global DOMParser */

const COMPONENT_PROPERTIES = {
	Text: [],
	Headline: [ 'level' ],
	Image: [ 'url', 'alt', 'align' ],
	Video: [ 'url', 'align' ]
};

export default class InstanceInspector {
	constructor( editor, instanceCollection ) {
		this.editor = editor;
		this.instanceCollection = instanceCollection;

		const structuredEditingPlugin = editor.plugins.get( 'StructuredEditing' );

		structuredEditingPlugin.on( 'select', ( evt, selectedInstanceUid ) => {
			this._selectedInstanceUid = selectedInstanceUid;

			this._updateForm();
		} );
	}

	renderTo( container ) {
		this._container = container;
	}

	_updateForm() {
		if ( !this._selectedInstanceUid || !this._container ) {
			return;
		}

		this._container.innerHTML = '';

		const instance = this.instanceCollection.getInstanceByUid( this._selectedInstanceUid );

		this._container.appendChild( d( `
			<h2>#${ instance.uid } ${ instance.name }</h2>
		` ) );

		if ( !instance.properties ) {
			return;
		}

		for ( const propName of COMPONENT_PROPERTIES[ instance.name ] ) {
			const field = this._createFormField( propName, instance.properties[ propName ] );

			this._container.appendChild( field );
		}
	}

	_createFormField( propName, propValue ) {
		let field;
		let input;

		switch ( propName ) {
			case 'url':
			case 'alt':
				field = d( `
					<div>
						<label for="input-${ propName }">${ propName }:</label>
						<input type="text" value="${ propValue }" id="input-${ propName }">
					</div>
				` );
				input = field.querySelector( 'input' );

				break;

			case 'level':
				field = d( `
					<div>
						<label for="input-${ propName }">${ propName }:</label>
						<input type="number" min="1" value="${ propValue }" id="input-${ propName }">
					</div>
				` );
				input = field.querySelector( 'input' );

				break;

			case 'align':
				field = d( `
					<div>
						<label for="input-${ propName }">${ propName }:</label>
						<select id="input-${ propName }">${ getAlignOptions( propValue ) }</select>
					</div>
				` );
				input = field.querySelector( 'select' );

				break;
		}

		input.addEventListener( 'input', () => {
			this.instanceCollection.setInstanceProperty( this._selectedInstanceUid, propName, detectType( input.value ) );
		} );

		return field;
	}
}

const parser = new DOMParser();

function d( htmlString ) {
	const doc = parser.parseFromString( htmlString, 'text/html' );

	return doc.body.firstElementChild;
}

function getAlignOptions( currentValue ) {
	return [ 'none', 'left', 'right' ].map( optionValue => {
		return `<option value="${ optionValue }" ${ optionValue == currentValue ? 'selected' : '' }>${ optionValue }</option>`;
	} );
}

function detectType( value ) {
	if ( value.match( /^\d+$/ ) ) {
		return Number( value );
	}

	return value;
}
