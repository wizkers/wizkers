/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


/**
 * A simple JSON over serial link protocol - mostly used for TCP or UDP sockets
 * 
 * @author Ed Lafargue, ed@wizkers.io
 */

define(function (require) {
    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        abu = require('app/lib/abutils'),
        Backbone = require('backbone');

    var Protocol = function() {
        var lenBuf = new Uint8Array(4);
        var lbdv = new DataView(lenBuf.buffer);
        var lenBufIdx = 0;
        var ibIdx = 0;
        var decodeBuffer = null; // Need a scope reference, but the buffer size changes so we don't initialize here
        var decodeBufferIdx = 0;
        var magic = 0xffff; // Arbitrary magic value for start of protocol. We are using
                            // JSON data, stringified, so we can't get this within the actual data
        var SYNC_MAGIC = 0,
            SYNC_LEN = 1,
            DECODE = 2;
        var state = SYNC_MAGIC;

        /**
         * Pack a JSON object and return an ArrayBuffer that can be
         * sent over the wire.
         * obj {Object} The javascript object to send over the line (JSON serialized)
         */
        this.write = function(obj) {
            try { // JSON stringify can fail
                var msg = abu.str2ab(JSON.stringify(obj));
                var len = msg.byteLength;

                var buf = new ArrayBuffer(len + 6);
                var dv = new DataView(buf);
                // Add the Magic + message length
                dv.setUint16(0,magic);
                dv.setUint32(2,len);
                // Now copy the message
                var b2 = new Uint8Array(buf, 6, len); // Does not take memory, b2 is just a view
                b2.set(new Uint8Array(msg));

                return buf;

            } catch (e) {
                console.error('Netlink write error', e);
            }
        }

        /**
         * Read from a binary stream and - if possible - decode JSON. With this pattern,
         * we will accumulate data until we sync then decode. This method will return empty
         * and trigger a 'data' event when something is decoded
         * data is an ArayBuffer
         */
        this.read = function (data) {
            var d8 = new Uint8Array(data); // Create a more convenient view on our buffer
            if (state == SYNC_MAGIC) {
                // Scan through the data for the magic number. We don't assume we are byte-aligned
                // upon protocol start, so we won't look of 0xffff but for 0xff, then check the next
                // byte is 0xff too
                var idx = d8.indexOf(0xff);
                if (idx > -1) {
                    if ((idx < (d8.byteLength-1)) && (d8[idx+1] == 0xff)) {
                        // Found our magic number!
                        state = SYNC_LEN;
                        lenBufIdx = 0;
                        ibIdx = idx+2; // Aligned with start of length
                        if (ibIdx >= d8.byteLength) {
                            ibIdx = 0;
                            return; // Not enough data in our buffer, wait for next packet,
                                    // which will start with length since we just decoded the magic
                        }
                    }
                } else {
                    // We didn't find anyting in our input buffer, so we drop it and continue
                    // waiting
                    return;
                }
            }

            if (state == SYNC_LEN) {
                // 2 situations possible:
                // - Our data buffer is long enough and holds enough bytes for the complete length
                // - ... or it's not
                while ((ibIdx < d8.byteLength) && (lenBufIdx < 4)) {
                    lenBuf[lenBufIdx++] = d8[ibIdx++];
                }
                if (lenBufIdx < 4) {
                    // We didn't get enough data in our packet for a complete length,
                    // wait until next time!
                    ibIdx = 0;
                    return;
                }
                // Yeah, we have a full length now! Create the buffer to receive our packet
                var dataLen = lbdv.getUint32(0); // Read as a Uint32
                decodeBuffer = new Uint8Array(dataLen);
                decodeBufferIdx = 0;
                state = DECODE;
            }

            if (state == DECODE) {
                // Now fill our decode buffer until we have all the data
                
                // For the sake of convenience, we can realign our data buffer.
                // Careful not to use 'data' but d8, because data is sometimes a
                // Uint8Array, in which case the constructor below disregards the offset.
                d8 = new Uint8Array(d8.buffer,ibIdx);
                if (decodeBuffer.byteLength - decodeBufferIdx > d8.byteLength) {
                    // Not enough data in our data buffer to decode everything, but
                    // let's decode what we can:
                    decodeBuffer.set(d8,decodeBufferIdx);
                    decodeBufferIdx += d8.byteLength;
                    //console.info("Still waiting for data, need", decodeBuffer.byteLength, "have", decodeBufferIdx );
                    ibIdx = 0; // Don't forget! If we don't reset this index for next time, we will lose data.
                    return;
                }
                // We have enough data by now (but we might have too much)
                decodeBuffer.set(d8.subarray(0, decodeBuffer.byteLength -decodeBufferIdx),decodeBufferIdx);
                var jsonStr = abu.ab2str(decodeBuffer);
                try {
                    state = SYNC_MAGIC;
                    this.trigger('data', JSON.parse(jsonStr));
                } catch (e) {
                    console.error("[Netlink] we got an error parsing an incoming JSON string", e);
                }

                // Do we have extra data ?
                // If so, then we need to call ourselves recursively
                if (d8.byteLength > decodeBuffer.byteLength - decodeBufferIdx) {
                    // Realign our data buffer:
                    var b = new Uint8Array(d8.buffer, decodeBuffer.byteLength - decodeBufferIdx+6);
                    this.read(b);
                }

            }

        }

    };

    _.extend(Protocol.prototype, Backbone.Events);
    
    return Protocol;


})