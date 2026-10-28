import { combineRgb } from '@companion-module/base'

const COUNTERS = [
	{ id: 'cues_to_make', label: 'Cues to make' },
	{ id: 'cues_to_update', label: 'Cues to update' },
	{ id: 'cues_to_delete', label: 'Cues to delete' },
	{ id: 'make_and_update', label: 'Cues to make + update' },
]

const ACTIVITIES = [
	{ id: 'busy', label: 'anything at all (not idle)' },
	{ id: 'making', label: 'making or updating cues' },
	{ id: 'deleting', label: 'deleting cues' },
	{ id: 'refreshing', label: 'refreshing Disguise' },
	{ id: 'calculating', label: 'matching cues' },
	{ id: 'error', label: 'an error' },
]

export function UpdateFeedbacks(self) {
	self.setFeedbackDefinitions({
		activity: {
			name: 'ToucanType is working',
			type: 'boolean',
			description: 'Lights a button while ToucanType is busy, so a trigger key shows it was heard.',
			defaultStyle: {
				bgcolor: combineRgb(0, 140, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'activity',
					type: 'dropdown',
					label: 'Doing',
					default: 'busy',
					choices: ACTIVITIES.map((a) => ({ id: a.id, label: a.label })),
				},
			],
			callback: (feedback) => {
				const state = self.state
				if (!state) return false
				//'making' covers the whole run - ToucanType reports 'calculating'
				//first while it works out what to do, then 'making'.
				if (feedback.options.activity === 'busy') return state !== 'idle'
				return state === feedback.options.activity
			},
		},

		connections: {
			name: 'Connection state',
			type: 'boolean',
			description: 'Whether ToucanType can reach the lighting console and Disguise.',
			defaultStyle: {
				bgcolor: combineRgb(0, 120, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'which',
					type: 'dropdown',
					label: 'When',
					default: 'console_up',
					choices: [
						{ id: 'console_up', label: 'the lighting console is connected' },
						{ id: 'console_down', label: 'the lighting console is not connected' },
						{ id: 'disguise_up', label: 'Disguise is connected' },
						{ id: 'disguise_down', label: 'Disguise is not connected' },
						{ id: 'all_up', label: 'both are connected' },
						{ id: 'one_up', label: 'only one is connected' },
						{ id: 'none_up', label: 'neither is connected' },
					],
				},
			],
			callback: (feedback) => {
				const consoleUp = !!self.connected.console
				const disguiseUp = !!self.connected.disguise
				const upCount = [consoleUp, disguiseUp].filter(Boolean).length

				switch (feedback.options.which) {
					case 'console_up':
						return consoleUp
					case 'console_down':
						return !consoleUp
					case 'disguise_up':
						return disguiseUp
					case 'disguise_down':
						return !disguiseUp
					case 'all_up':
						return upCount === 2
					case 'one_up':
						return upCount === 1
					case 'none_up':
						return upCount === 0
					default:
						return false
				}
			},
		},

		cues_outstanding: {
			name: 'Cue count comparison',
			type: 'boolean',
			description: 'Restyles the button based on how much work is outstanding in ToucanType.',
			defaultStyle: {
				bgcolor: combineRgb(200, 110, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'counter',
					type: 'dropdown',
					label: 'Count',
					default: 'make_and_update',
					choices: COUNTERS.map((c) => ({ id: c.id, label: c.label })),
				},
				{
					id: 'comparison',
					type: 'dropdown',
					label: 'Is',
					default: 'gt',
					choices: [
						{ id: 'gt', label: 'greater than' },
						{ id: 'gte', label: 'greater than or equal to' },
						{ id: 'eq', label: 'equal to' },
						{ id: 'lt', label: 'less than' },
					],
				},
				{
					id: 'value',
					type: 'number',
					label: 'Value',
					default: 0,
					min: 0,
					max: 100000,
				},
			],
			callback: (feedback) => {
				const counts = self.counts
				const left =
					feedback.options.counter === 'make_and_update'
						? (counts.cues_to_make ?? 0) + (counts.cues_to_update ?? 0)
						: counts[feedback.options.counter]

				//Nothing heard yet - don't imply there is work outstanding.
				if (left === undefined || left === null || Number.isNaN(left)) return false

				const right = Number(feedback.options.value)
				switch (feedback.options.comparison) {
					case 'gt':
						return left > right
					case 'gte':
						return left >= right
					case 'eq':
						return left === right
					case 'lt':
						return left < right
					default:
						return false
				}
			},
		},
	})
}
