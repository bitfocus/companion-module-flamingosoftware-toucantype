import dgram from 'dgram'
import { encodeMessage, decodePacket } from './osc.js'

///The five values ToucanType publishes, mapped to Companion variable ids.
export const STATUS_KEYS = {
	cuesToMake: 'cues_to_make',
	cuesToUpdate: 'cues_to_update',
	cuesToDelete: 'cues_to_delete',
	showProgress: 'show_progress',
	message: 'message',
	state: 'state',
	disguise: 'disguise',
	console: 'console',
}

export const DEFAULT_ROOT = '/toucantype/status'

/**
 * One UDP socket, used for both directions.
 *
 * Binding it means ToucanType's status feed lands here, and it also gives our
 * outgoing triggers a fixed source port, which is friendlier to firewalls than
 * an ephemeral one.
 */
export class ToucanTypeLink {
	constructor(instance) {
		this.instance = instance
		this.socket = null
		this.bound = false
	}

	start(listenPort) {
		this.stop()

		const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
		this.socket = socket

		socket.on('error', (err) => {
			this.instance.log('error', `Status socket error: ${err.message}`)
			this.instance.onLinkError(err, listenPort)
			this.stop()
		})

		socket.on('message', (buffer, rinfo) => {
			this.#handlePacket(buffer, rinfo)
		})

		socket.on('listening', () => {
			this.bound = true
			this.instance.log('info', `Listening for ToucanType status on UDP ${listenPort}`)
			this.instance.onLinkReady()
		})

		try {
			socket.bind(listenPort)
		} catch (err) {
			this.instance.log('error', `Could not bind UDP ${listenPort}: ${err.message}`)
			this.instance.onLinkError(err, listenPort)
		}
	}

	stop() {
		if (!this.socket) return
		try {
			this.socket.close()
		} catch {
			// Already closed - nothing to do.
		}
		this.socket = null
		this.bound = false
	}

	///Sends an address with no arguments, which is all ToucanType's triggers need.
	send(address, host, port) {
		if (!this.socket) {
			this.instance.log('warn', `Not sending ${address}: socket is not open`)
			return
		}
		if (!host) {
			this.instance.log('warn', `Not sending ${address}: no ToucanType IP configured`)
			return
		}

		let buffer
		try {
			buffer = encodeMessage(address)
		} catch (err) {
			this.instance.log('error', `Could not build ${address}: ${err.message}`)
			return
		}

		this.socket.send(buffer, 0, buffer.length, Number(port), host, (err) => {
			if (err) {
				this.instance.log('error', `Failed to send ${address}: ${err.message}`)
			} else {
				this.instance.log('debug', `Sent ${address} to ${host}:${port}`)
			}
		})
	}

	#handlePacket(buffer, rinfo) {
		let packet
		try {
			packet = decodePacket(buffer)
		} catch (err) {
			this.instance.log('debug', `Ignoring unparseable packet from ${rinfo.address}: ${err.message}`)
			return
		}
		this.#handleDecoded(packet, rinfo)
	}

	#handleDecoded(packet, rinfo) {
		//ToucanType sends plain messages, but handle a bundle so a router in the
		//middle that wraps things doesn't silently break us.
		if (packet && Array.isArray(packet.packets)) {
			for (const child of packet.packets) this.#handleDecoded(child, rinfo)
			return
		}
		if (!packet || typeof packet.address !== 'string') return

		const key = ToucanTypeLink.keyFor(packet.address)
		if (!key) {
			this.instance.log('debug', `Unrecognised status address ${packet.address}`)
			return
		}

		const value = Array.isArray(packet.args) ? packet.args[0] : undefined
		if (value === undefined) return

		this.instance.onStatusValue(key, value, rinfo)
	}

	/**
	 * ToucanType lets the user retype its outgoing addresses, so match the
	 * default first and then fall back to the trailing path component. That
	 * covers someone who has changed the root but kept the names.
	 */
	static keyFor(address) {
		for (const key of Object.keys(STATUS_KEYS)) {
			if (address === `${DEFAULT_ROOT}/${key}`) return key
		}
		const last = address.split('/').filter(Boolean).pop()
		return Object.keys(STATUS_KEYS).includes(last) ? last : null
	}
}
