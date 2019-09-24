/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

export function uid() {
	return Array( 10 ).fill( 0 ).map( () => Math.random().toString( 36 ).charAt( 2 ) ).join( '' );
}
