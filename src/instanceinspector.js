/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* global DOMParser */

const COMPONENT_PROPS = {
	default: [],
	headline: [ 'level' ],
	image: [ 'url', 'alt', 'align' ],
	video: [ 'url', 'alt', 'align' ]
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

		if ( !instance.props ) {
			return;
		}

		for ( const propName of COMPONENT_PROPS[ instance.name ] ) {
			const field = this._createFormField( propName, instance.props[ propName ] );

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
						<label>${ propName }: <input type="text" value="${ propValue }"></label>
					</div>
				` );
				input = field.querySelector( 'input' );

				break;

			case 'level':
				field = d( `
					<div>
						<label>${ propName }: <input type="number" min="1" value="${ propValue }"></label>
					</div>
				` );
				input = field.querySelector( 'input' );

				break;

			case 'align':
				field = d( `
					<div>
						<label>${ propName }: <select>${ getAlignOptions( propValue ) }</select></label>
					</div>
				` );
				input = field.querySelector( 'select' );

				break;
		}

		input.addEventListener( 'change', () => {
			this.instanceCollection.setInstanceProp( this._selectedInstanceUid, propName, detectType( input.value ) );
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
