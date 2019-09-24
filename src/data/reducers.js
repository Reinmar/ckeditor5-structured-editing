/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

import { combineReducers } from 'redux';
import defaultBlocks from './defaultblocks';
import {
	ADD_BLOCK,
	EDIT_BLOCK,
	REMOVE_BLOCK,
	MOVE_BLOCK,
	TOGGLE_BLOCK_DETAILS,
	TOGGLE_DOCUMENT_OUTLINE
} from './actions';

export default combineReducers( {
	blocks,
	documentOutline,
	blockDetails
} );

function blocks( state = defaultBlocks, action ) {
	switch ( action.type ) {
		case ADD_BLOCK:
			return _addBlock( state, action );
		case EDIT_BLOCK:
			return state.map( ( block, index ) => {
				if ( index === action.index ) {
					return Object.assign( {}, block, action.data );
				}

				return block;
			} );
		case REMOVE_BLOCK:
			return _removeBlock( state, action );
		case MOVE_BLOCK:
			return _addBlock(
				_removeBlock( state, {
					index: action.index
				} ),
				{
					index: action.destination,
					data: state[ action.index ]
				}
			);
		default:
			return state;
	}
}

function documentOutline( state = true, action ) {
	if ( action.type === TOGGLE_DOCUMENT_OUTLINE ) {
		return !state;
	}

	return state;
}

function blockDetails( state = true, action ) {
	if ( action.type === TOGGLE_BLOCK_DETAILS ) {
		return !state;
	}

	return state;
}

function _addBlock( state, action ) {
	return [
		...state.slice( 0, action.index ),
		action.data,
		...state.slice( action.index ),
	];
}

function _removeBlock( state, action ) {
	return [
		...state.slice( 0, action.index ),
		...state.slice( action.index + 1 )
	];
}
