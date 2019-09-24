/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

import { uid } from '../utils';

const sampleText =
	'The framework was designed to be a highly flexible and universal ' +
	'platform for creating custom rich-text editing solutions. ';

export default [
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
	}
];
