import { combineRgb } from '@companion-module/base'

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const AMBER = combineRgb(200, 110, 0)
const GREEN = combineRgb(0, 120, 0)
const RED = combineRgb(160, 0, 0)

///Rows of "Label: value" read better ranged left, so the colons line up.
const LEFT = 'left:center'

/**
 * Text size for every preset.
 *
 * Companion 5 stores text size as a percentage of the element height, but a
 * preset's `size` is still in the old pixel units, so it converts on import.
 * With the top bar hidden - which every preset here does - the scale is 1 / 0.6,
 * so a preset saying 20 shows up as 33.3 in the button editor. See
 * ParseLegacyStyle in companion/lib/Resources/ConvertLegacyStyleToElements.ts:
 *
 *   const TEXT_SIZE_SCALE_NO_TOPBAR = 1 / 0.6
 *   textSize = Number((n * scale).toFixed(1))
 *   textSizeAllowShrink = false
 *
 * So set the size we want to see in the editor, and undo the conversion here.
 *
 * Note the last line: any numeric size also turns "Shrink to fit" OFF. Only
 * 'auto' turns it on, and that pins the size to 100. A preset can have a chosen
 * size or shrink-to-fit, never both - the two are only independent per-button in
 * the Style tab.
 */

///Turns the size you want to see in the button editor into what a preset must
///send for Companion's import to land on it.
const editorSize = (size) => Number((size * 0.6).toFixed(1))

///Sizes as they appear in Companion's button editor.
const SIZE = {
	default: editorSize(20),
	progress: editorSize(18),
}

export function UpdatePresets(self) {
	const trigger = (text, actionId, bgcolor, feedbacks = []) => ({
		type: 'simple',
		name: text.replace('\n', ' '),
		style: {
			text,
			size: SIZE.default,
			color: WHITE,
			bgcolor,
			alignment: 'center:center',
			show_topbar: false,
		},
		steps: [{ down: [{ actionId, options: {} }], up: [] }],
		feedbacks,
	})

	/**
	 * Swaps the key to a green "doing it" label while ToucanType is running the
	 * thing this key asked for. A feedback style is a partial button style, so
	 * anything not named here - size, alignment - stays as the button has it.
	 */
	const workingFeedback = (activity, text) => ({
		feedbackId: 'activity',
		options: { activity },
		style: { text, bgcolor: combineRgb(0, 140, 0), color: WHITE },
	})

	const readout = (name, text, size, feedbacks = [], alignment = 'center:center') => ({
		type: 'simple',
		name,
		style: {
			text,
			size,
			color: WHITE,
			bgcolor: BLACK,
			alignment,
			show_topbar: false,
		},
		steps: [],
		feedbacks,
	})

	const outstandingFeedback = (counter) => ({
		feedbackId: 'cues_outstanding',
		options: { counter, comparison: 'gt', value: 0 },
		style: { bgcolor: AMBER, color: WHITE },
	})

	const connectionFeedback = (which, bgcolor) => ({
		feedbackId: 'connections',
		options: { which },
		style: { bgcolor, color: WHITE },
	})

	const presets = {
		make_live: trigger('Make\nLive', 'make_live', combineRgb(160, 80, 0), [workingFeedback('making', 'Creating...')]),
		make_blind: trigger('Make\nBlind', 'make_blind', combineRgb(0, 70, 150), [workingFeedback('making', 'Creating...')]),
		refresh: trigger('Refresh\nDisguise', 'refresh_disguise', combineRgb(60, 60, 60), [workingFeedback('refreshing', 'Refreshing...')]),
		delete_cues: trigger('Delete\nCues', 'delete_cues', combineRgb(150, 0, 0), [workingFeedback('deleting', 'Deleting...')]),

		connections: readout(
			'EOS connection',
			'EOS\n$(ToucanType:console)',
			SIZE.default,
			[
				connectionFeedback('console_up', GREEN),
				connectionFeedback('console_down', RED),
			],
		),

		connections_all: readout(
			'EOS + Disguise connections',
			'D3: $(ToucanType:disguise)\nEOS: $(ToucanType:console)',
			SIZE.default,
			[
				//Mutually exclusive, so the order here doesn't matter.
				connectionFeedback('all_up', GREEN),
				connectionFeedback('one_up', AMBER),
				connectionFeedback('none_up', RED),
			],
			LEFT,
		),

		progress: readout('Show progress', 'PROGRESS\n$(ToucanType:show_progress)%', SIZE.progress),

		//One key per count, each lighting up for its own number rather than for
		//something it doesn't display.
		count_make: readout('Cues to make', 'MAKE\n$(ToucanType:cues_to_make)', SIZE.default, [
			outstandingFeedback('cues_to_make'),
		]),
		count_update: readout('Cues to update', 'UPDATE\n$(ToucanType:cues_to_update)', SIZE.default, [
			outstandingFeedback('cues_to_update'),
		]),
		count_delete: readout('Cues to delete', 'DELETE\n$(ToucanType:cues_to_delete)', SIZE.default, [
			outstandingFeedback('cues_to_delete'),
		]),

		//The two counts that matter before a session, one line each.
		outstanding: readout(
			'Make + Update',
			'Make: $(ToucanType:cues_to_make)\nUpdate: $(ToucanType:cues_to_update)',
			SIZE.default,
			[outstandingFeedback('make_and_update')],
			LEFT,
		),

		//Everything on one key, for people who would rather not spend three.
		outstanding_all: readout(
			'Make + Update + Delete',
			'Make: $(ToucanType:cues_to_make)\nUpdate: $(ToucanType:cues_to_update)\nDelete: $(ToucanType:cues_to_delete)',
			SIZE.default,
			[outstandingFeedback('make_and_update')],
			LEFT,
		),
	}

	const structure = [
		{
			id: 'toucantype',
			name: 'ToucanType',
			definitions: [
				{
					id: 'triggers',
					name: 'Triggers',
					description: 'Make, update and delete cues from a key.',
					type: 'simple',
					presets: ['make_live', 'make_blind', 'refresh', 'delete_cues'],
				},
				{
					id: 'status',
					name: 'Status',
					description: 'Read-only keys showing how much work is outstanding.',
					type: 'simple',
					presets: [
						'connections',
						'connections_all',
						'outstanding',
						'outstanding_all',
						'progress',
						'count_make',
						'count_update',
						'count_delete',
					],
				},
			],
		},
	]

	self.setPresetDefinitions(structure, presets)
}
