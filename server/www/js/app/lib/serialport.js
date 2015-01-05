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
 * A browser-side implementation of the same type of API as the
 * Node.js Serialport library
 *
 * I only implement what makes sense for my application.
 *
 * @author Edouard Lafargue <edouard@lafargue.name>
 *
 * based on NodeSerial Parsers, Copyright 2011 Chris Williams <chris@iterativedesigns.com>
 * 
 */

define(function(require) {
    
    "use strict";
    
    // From chrome developer API:
    function ab2str(buf) {
            return String.fromCharCode.apply(null, new Uint8Array(buf));
    };

    // Convert string to ArrayBuffer
    var str2ab = function(str) {
        var buf=new ArrayBuffer(str.length);
        var bufView=new Uint8Array(buf);
        for (var i=0; i<str.length; i++) {
            bufView[i]=str.charCodeAt(i);
        }
        return buf;
    };


    // Inportant: buffer is a Javascript ArrayBuffer
    var parsers ={
          raw: function (emitter, buffer) {
            emitter.trigger("data", buffer);
          },
          //encoding: ascii utf8 utf16le ucs2 base64 binary hex
          //More: http://nodejs.org/api/buffer.html#buffer_buffer
          readline: function (delimiter, encoding) {
            if (typeof delimiter === "undefined" || delimiter === null) { delimiter = "\r"; }
            if (typeof encoding  === "undefined" || encoding  === null) { encoding  = "utf8"; }
            // Delimiter buffer saved in closure
            var data = "";
            return function (emitter, buffer) {
              // Collect data
              data += ab2str(buffer);
              // Split collected data by delimiter
              var parts = data.split(delimiter);
              data = parts.pop();
              parts.forEach(function (part, i, array) {
                emitter.trigger('data', part);
              });
            };
          }
        };

    return {
        
        parsers: parsers
        
    }
    
});