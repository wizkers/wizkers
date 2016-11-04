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
 *  Various useful utility functions.
 *
 * Original code (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 * hexdump code: Matt Mower <self@mattmower.com
 * 08-02-2011
 * License: MIT
 *
 */

if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function(require) {

    "use strict";

    function to_hex( number ) {
            var r = number.toString(16);
            if( r.length < 2 ) {
                return "0" + r;
            } else {
                return r;
            }
    };

    function dump_chunk( chunk ) {
        var dumped = "";
        for( var i = 0; i < 4; i++ ) {
            if( i < chunk.length ) {
                dumped += to_hex( chunk.charCodeAt( i ) );
            } else {
                dumped += "..";
            }
        }
        return dumped;
    };

    function dump_block( block ) {
        var dumped = "";
        var chunks = block.match( /[\s\S.]{1,4}/g );
        for( var i = 0; i < 4; i++ ) {
            if( i < chunks.length ) {
                dumped += dump_chunk( chunks[i] );
            } else {
                dumped += "........";
            }
            dumped += " ";
        }

        dumped += "    " + block.replace( /[\x00-\x1F]/g, "." );

        return dumped;
    };

    var decoder, encoder;
    var enc_ok = false;
    /** Note, 2016.09.23: we are deactivating the use of TextDecoder for now,
     * because some browsers (IOS Webview) don't support it and this creates
     * UTF-8 to/from conversion issues.
     */
    /*
    if ( typeof TextDecoder == 'function') {
        decoder = new TextDecoder("utf-8");
        encoder = new TextEncoder("utf-8");
        enc_ok = true;
    }
    */

    var nullstring = String.fromCharCode(0);

    return {

        // Utility function (chrome serial wants array buffers for sending)

        // Note: we assume ISO-8859 encoding here, not UTF-8 (see previous note above)

        // Convert string to ArrayBuffer.
        str2ab: function(str) {
        //  some drivers already give us an Uint8Buffer, because they
        // handle binary data. in that case
        // this makes our job easier:
            if (str.buffer)
                return str.buffer;

            if (enc_ok)
                return encoder.encode(str).buffer;

            var buf=new ArrayBuffer(str.length);
            var bufView=new Uint8Array(buf);
            for (var i=0, j=str.length; i<j; i++) {
                bufView[i]=str.charCodeAt(i);
            }
            return buf;
        },

        ab2str: function(buf) {
            // Implementation using the TextDecoder API
            // if present
            if (enc_ok) {
                // TODO: surely there must be a better way?
                // Looks like decoder does notreally follow
                // null terminated strings properly, hence this:
                var str = decoder.decode(buf);
                var i = str.indexOf(nullstring);
                return str.substr(0, (i != -1) ? i :  str.length);
            }
            // The below will fail on very large buffers by blowing the stack size:
            //return String.fromCharCode.apply(null, new Uint8Array(buf));
            // This will work with any buffer size:
            return [].reduce.call(new Uint8Array(buf),function(p,c){return p+String.fromCharCode(c)},'');
        },


        /// Converts a Hex string to a UInt8Array
        // For instance "010203efab23" as input
        hextoab: function(str) {
            if (str.length%2 != 0)
                throw "Not an even number of characters"; // We need an even number
            var ab = new Uint8Array(str.length/2);
            for (var i=0;  i < str.length; i +=2) {
                ab[i/2] = parseInt(str.substr(i,2), 16);
            }
            return ab;
        },

        // Convert Uint8Array to hex string
        ui8tohex: function(ui8) {
            var str = '';
            for (var i=0; i < ui8.length; i++) {
                str += ('0' + ui8[i].toString(16)).slice(-2);
            }
            return str;
        },

        // Create an Uint8Array from an ASCII string
        str2ui8: function(str) {
            var bufView=new Uint8Array(str.length);
            for (var i=0, j=str.length; i<j; i++) {
                bufView[i]=str.charCodeAt(i);
            }
            return bufView;
        },

        // Dump a binary string or Uint8Array
        hexdump: function( s ) {
            var dumped = "";
            if (typeof s != "string")
                s = String.fromCharCode.apply(null, new Uint8Array(s));
            var blocks = s.match( /[\s\S.]{1,16}/g );
            for( var block in blocks ) {
                dumped += dump_block( blocks[block] ) + "\r\n";
            }

            return dumped;
        },

        // Pad a buffer (a type array)
        pad: function (buf, padding) {

            if (buf.byteLength % padding == 0)
                return buf;
            var missing = padding - (buf.byteLength%padding);
            // Now extend the buffer by the missing characters:
            var b2 = new Uint8Array(buf.byteLength + missing);
            b2.set(buf);
            for (var i=buf.byteLength; i < b2.byteLength; i++) {
                b2[i] = 0xff;
            }
            return b2;
        }


    }

});