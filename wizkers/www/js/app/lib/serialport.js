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
            emitter.onDataReady(buffer);
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
                emitter.onDataReady(part);
              });
            };
          },

          // Compatibility with new stype Node 5.0 parsers
          //encoding: ascii utf8 utf16le ucs2 base64 binary hex
          //More: http://nodejs.org/api/buffer.html#buffer_buffer
          Readline: function (options) {
            var delimiter = options.delimiter;
            var encoding = options.encoding;
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
                emitter.onDataReady(part);
              });
            };
          }


        };

    return {

        parsers: parsers

    }

});