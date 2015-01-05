/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
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
	
    return {
        
        // Utility function (chrome serial wants array buffers for sending)
        // Convert string to ArrayBuffer.
        str2ab: function(str) {
        //  some drivers already give us an Uint8Buffer, because they
        // handle binary data. in that case
        // this makes our job easier:
            if (str.buffer)
                return str.buffer;
            var buf=new ArrayBuffer(str.length);
            var bufView=new Uint8Array(buf);
            for (var i=0, j=str.length; i<j; i++) {
                bufView[i]=str.charCodeAt(i);
            }
            return buf;
        },

        ab2str: function(buf) {
            return String.fromCharCode.apply(null, new Uint8Array(buf));
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
                s = this.ab2str(s);
            var blocks = s.match( /[\s\S.]{1,16}/g );
            for( var block in blocks ) {
                dumped += dump_block( blocks[block] ) + "\n";
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