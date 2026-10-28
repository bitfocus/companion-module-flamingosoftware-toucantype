///The triggers ToucanType listens for on its OSC trigger port (5050).
export const TRIGGERS = {
	make_live: { name: 'Make / Update Cues (Live)', address: '/toucantype/make' },
	make_blind: { name: 'Make / Update Cues (Blind)', address: '/toucantype/make/blind' },
	refresh_disguise: { name: 'Refresh Disguise', address: '/toucantype/disguise/refresh' },
	delete_cues: { name: 'Delete Unmatched Console Cues', address: '/toucantype/delete' },
}

export function UpdateActions(self) {
	const definitions = {}

	for (const [id, trigger] of Object.entries(TRIGGERS)) {
		definitions[id] = {
			name: trigger.name,
			options: [],
			callback: async () => {
				self.sendTrigger(trigger.address)
			},
		}
	}

	self.setActionDefinitions(definitions)
}
