/**
 * Minimal OSC 1.0 encode / decode.
 *
 * ToucanType's triggers take no arguments, and its status feed sends one
 * argument per message, so the whole spec isn't needed. Hand-rolling it keeps
 * the module dependency-free: the obvious library (`osc`) pulls in serialport,
 * which is a native addon - it would be built against whatever Node is on the
 * machine rather than the one Companion runs modules with, and native addons
 * need an explicit permission in the manifest.
 */

///OSC pads everything to a multiple of 4 bytes.
const padded = (length) => (length + 3) & ~3

function encodeString(value) {
	const bytes = Buffer.from(value, 'utf8')
	//At least one null terminator, then padded out to a multiple of 4.
	const out = Buffer.alloc(padded(bytes.length + 1))
	bytes.copy(out)
	return out
}

function readString(buffer, offset) {
	let end = offset
	while (end < buffer.length && buffer[end] !== 0) end++
	if (end >= buffer.length) throw new Error('unterminated OSC string')
	return {
		value: buffer.toString('utf8', offset, end),
		offset: offset + padded(end - offset + 1),
	}
}

///Builds a message with no arguments, which is all a ToucanType trigger needs.
export function encodeMessage(address) {
	return Buffer.concat([encodeString(address), encodeString(',')])
}

export function decodePacket(buffer) {
	if (buffer.length >= 8 && buffer.toString('ascii', 0, 7) === '#bundle') {
		return decodeBundle(buffer)
	}
	return decodeMessage(buffer)
}

function decodeMessage(buffer) {
	const head = readString(buffer, 0)
	if (!head.value.startsWith('/')) throw new Error('not an OSC message')

	const address = head.value
	let offset = head.offset
	const args = []

	//A message may legitimately carry no type tag string at all.
	if (offset < buffer.length) {
		const tagString = readString(buffer, offset)
		offset = tagString.offset

		const tags = tagString.value.startsWith(',') ? tagString.value.slice(1) : ''
		for (const tag of tags) {
			switch (tag) {
				case 'i':
					args.push(buffer.readInt32BE(offset))
					offset += 4
					break
				case 'f':
					args.push(buffer.readFloatBE(offset))
					offset += 4
					break
				case 's': {
					const string = readString(buffer, offset)
					args.push(string.value)
					offset = string.offset
					break
				}
				case 'b': {
					const size = buffer.readInt32BE(offset)
					offset += 4
					args.push(buffer.subarray(offset, offset + size))
					//Blob data is padded, but without the extra null a string gets.
					offset += padded(size)
					break
				}
				case 'T':
					args.push(true)
					break
				case 'F':
					args.push(false)
					break
				case 'N':
					args.push(null)
					break
				default:
					//An unknown tag means we can no longer trust the offset.
					throw new Error(`unsupported OSC type tag '${tag}'`)
			}
		}
	}

	return { address, args }
}

function decodeBundle(buffer) {
	//'#bundle\0' is 8 bytes, the time tag another 8.
	let offset = 16
	const packets = []

	while (offset + 4 <= buffer.length) {
		const size = buffer.readInt32BE(offset)
		offset += 4
		if (size <= 0 || offset + size > buffer.length) break
		packets.push(decodePacket(buffer.subarray(offset, offset + size)))
		offset += size
	}

	return { packets }
}
