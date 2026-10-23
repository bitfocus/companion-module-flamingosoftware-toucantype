///v2 takes an object keyed by variable id, not v1's array of { variableId, name }.
export function UpdateVariableDefinitions(self) {
	self.setVariableDefinitions({
		cues_to_make: { name: 'Cues to make' },
		cues_to_update: { name: 'Cues to update' },
		cues_to_delete: { name: 'Cues to delete' },
		show_progress: { name: 'Show progress (%)' },
		message: { name: 'Status message' },
		state: { name: 'What ToucanType is doing' },
		disguise: { name: 'Disguise connection' },
		console: { name: 'Lighting console connection' },
		last_update: { name: 'Last status received (local time)' },
	})
}
