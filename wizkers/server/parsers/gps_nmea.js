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

// https://github.com/jamesp/node-nmea
// A parser for the NMEA GPS units
// the idea here is to display location on a map + the satellites on an
// almanach view. Nothing super fancy, but useful nevertheless.

//////////
//
//    WORK IN PROGRESS
//
//////////


// This object contains two entries:
//  - The low level parser for the serial port driver
//  - The high level parser for incoming serial port data

var serialport = require('serialport'),
    SerialPort  = serialport.SerialPort;

module.exports = {

    // Set a reference to the socket.io socket and port
    socket: null,
    recorder: null,

    setPortRef: function(s) {
    },
    setSocketRef: function(s) {
        this.socket = s;
    },
    setInstrumentRef: function(i) {
    },




    // How the device is connected on the serial port
    portSettings: function() {
        return  {
            baudRate: 115200,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            // simply pass each line to our JSON streaming parser
            // Note: the Onyx outputs json with \n at the end, so
            // the default readline parser works fine (it separates on \r)
            parser: serialport.parsers.readline('\n'),
        }
    },

    // Called when the HTML app needs a unique identifier.
    // this is a standardized call across all drivers.
    // This particular device does not support this concept, so we
    // always return the same
    sendUniqueID: function() {
        this.socket.emit('uniqueID','00000000 (n.a.)');
    },


    // format should return a JSON structure.
    format: function(data, recording) {
        // console.log('FC Oled Backpack - format output');
        // Remove any carriage return
        data = data.replace('\n','');
        var fields = data.split(':');
        // Format is :Vbus:Abus:Vload:Aload:
        // We only return the load values:
        var res = { "v": fields[3], "a": fields[4] };
        this.socket.emit('serialEvent',res);
    },

    // output should return a string, and is used to format
    // the data that is sent on the serial port, coming from the
    // HTML interface.
    output: function(data) {
        return data + '\n';
    }

};
