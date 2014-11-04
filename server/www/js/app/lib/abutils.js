/**
 *  Various useful utility functions.
 *
 * Original code (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 * Some parts of this code come from Christophe Coenraets, license unclear ? TODO
 */

define(function(require) {
    
    "use strict";
    
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
            if (!str.length%2)
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
        }


        
    }
    
});