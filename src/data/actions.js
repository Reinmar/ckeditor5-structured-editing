/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* Action names */

export const ADD_BLOCK = 'ADD_BLOCK';
export const REMOVE_BLOCK = 'REMOVE_BLOCK';
export const MOVE_BLOCK = 'MOVE_BLOCK';
export const EDIT_BLOCK = 'EDIT_BLOCK';
export const TOGGLE_DOCUMENT_OUTLINE = 'TOGGLE_DOCUMENT_OUTLINE';
export const TOGGLE_BLOCK_DETAILS = 'TOGGLE_BLOCK_DETAILS';

/* Action creators */

export function addBlock( data, index ) {
	return {
		type: ADD_BLOCK,
		index,
		data
	};
}

export function removeBlock( index ) {
	return {
		type: REMOVE_BLOCK,
		index
	};
}

export function editBlock( data, index ) {
	return {
		type: EDIT_BLOCK,
		data,
		index
	};
}

export function moveBlock( index, destination ) {
	return {
		type: MOVE_BLOCK,
		index,
		destination
	};
}

export function toggleDocumentOutline() {
	return { type: TOGGLE_DOCUMENT_OUTLINE };
}

export function toggleBlockDetails() {
	return { type: TOGGLE_BLOCK_DETAILS };
}
