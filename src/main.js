import { InstanceBase, InstanceStatus, Regex } from '@companion-module/base'

import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpdatePresets } from './presets.js'
import { ToucanTypeLink, STATUS_KEYS } from './link.js'

//module-base v2 dropped runEntrypoint: the host imports this file and expects
//the instance class as the default export, with the upgrade scripts named.
export { UpgradeScripts }

export default class ToucanTypeInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.link = null

		//Latest counts, used by feedbacks. Undefined until ToucanType tells us.
		this.counts = {
			cues_to_make: undefined,
			cues_to_update: undefined,
			cues_to_delete: undefined,
		}

		this.hasHeardFromToucanType = false
		this.retryTimer = undefined

		///Latest value of the `state` address: idle, making, deleting and so on.
		this.state = 'idle'

		///Whether each end is reachable, for the connection feedback.
		this.connected = { disguise: false, console: false }
	}

	async init(config) {
		this.config = config

		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()

		this.#openLink()
	}

	async configUpdated(config) {
		const portChanged = config.listenPort !== this.config?.listenPort
		this.config = config
		//Only rebind when the listen port moved; the target IP is read per send.
		if (portChanged) this.#openLink()
	}

	async destroy() {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer)
			this.retryTimer = undefined
		}
		this.link?.stop()
		this.link = null
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'ToucanType',
				value:
					'Set the IP of the Mac running ToucanType. In ToucanType, open Settings &gt; OSC Triggers, ' +
					'turn on <b>Send Status</b> and point it at this computer on the Status Listen Port below. ' +
					'Leave the status addresses at their defaults.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'ToucanType IP',
				width: 8,
				regex: Regex.IP,
			},
			{
				type: 'textinput',
				id: 'triggerPort',
				label: 'Trigger Port (ToucanType listens here)',
				width: 4,
				default: '5050',
				regex: Regex.PORT,
			},
			{
				type: 'textinput',
				id: 'listenPort',
				label: 'Status Listen Port (this computer)',
				width: 4,
				default: '5051',
				regex: Regex.PORT,
			},
		]
	}

	#openLink() {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer)
			this.retryTimer = undefined
		}
		this.link?.stop()
		this.link = new ToucanTypeLink(this)

		const port = Number(this.config?.listenPort ?? 5051)
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			this.updateStatus(InstanceStatus.BadConfig, 'Status Listen Port must be 1-65535')
			return
		}

		this.updateStatus(InstanceStatus.Connecting)
		this.link.start(port)
	}

	// MARK: - callbacks from the link

	onLinkReady() {
		//UDP is connectionless and ToucanType only sends on change, so silence is
		//normal. Ok means "bound and listening", not "ToucanType is talking to us".
		this.updateStatus(
			InstanceStatus.Ok,
			this.hasHeardFromToucanType ? undefined : 'Waiting for first status from ToucanType',
		)
	}

	onLinkError(err, listenPort) {
		//EADDRINUSE is by far the most common one, and the message Node gives is
		//not much help to someone who has no idea what else is on that port.
		const message =
			err?.code === 'EADDRINUSE'
				? `UDP ${listenPort} is already in use. Close whatever else is listening on it ` +
					`(OSCRouter, or an old copy of this module), or set a different Status Listen Port.`
				: (err?.message ?? 'Status socket failed')

		this.updateStatus(InstanceStatus.ConnectionFailure, message)
		this.#scheduleRetry()
	}

	/**
	 * A busy port usually frees up on its own once the other app is closed, so
	 * keep trying rather than sitting in a failed state until someone notices.
	 */
	#scheduleRetry() {
		if (this.retryTimer) return
		this.retryTimer = setTimeout(() => {
			this.retryTimer = undefined
			this.log('debug', 'Retrying the status socket')
			this.#openLink()
		}, 10000)
	}

	onStatusValue(key, value, rinfo) {
		if (!this.hasHeardFromToucanType) {
			this.hasHeardFromToucanType = true
			this.log('info', `First status received from ${rinfo.address}`)
			this.updateStatus(InstanceStatus.Ok)
		}

		const variableId = STATUS_KEYS[key]
		if (!variableId) return

		this.setVariableValues({
			[variableId]: ToucanTypeInstance.#presentable(variableId, value),
			last_update: new Date().toLocaleTimeString(),
		})

		if (variableId in this.counts) {
			this.counts[variableId] = Number(value)
			this.checkFeedbacks('cues_outstanding')
		}

		if (variableId === 'state') {
			this.state = String(value)
			this.checkFeedbacks('activity')
		}

		if (variableId === 'disguise' || variableId === 'console') {
			this.connected[variableId] = String(value) === 'connected'
			this.checkFeedbacks('connections')
		}
	}

	/**
	 * ToucanType sends the progress as an OSC float32, and float32 can't hold a
	 * value like 47.3 exactly - it decodes to 47.29999923706055, which is what a
	 * button would then display. Round it back to the 0.1 ToucanType intended.
	 */
	static #presentable(variableId, value) {
		//"D3: connected" is too wide for a key; "D3: OK" is not.
		if (variableId === 'disguise' || variableId === 'console') {
			return String(value) === 'connected' ? 'OK' : 'Offline'
		}

		if (variableId !== 'show_progress') return value
		const number = Number(value)
		return Number.isFinite(number) ? Math.round(number * 10) / 10 : value
	}

	// MARK: - used by actions

	sendTrigger(address) {
		this.link?.send(address, this.config?.host, this.config?.triggerPort ?? 5050)
	}

	updateActions() {
		UpdateActions(this)
	}
	updateFeedbacks() {
		UpdateFeedbacks(this)
	}
	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}
	updatePresets() {
		UpdatePresets(this)
	}
}
