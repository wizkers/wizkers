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

/*
 * Browser-side Parser for Kenwood tm-v71A radios
 *
 *
 * The Browser-side parser is used when running as a Chrome or Cordova app.
 *
 * Differences with server-side parser:
 *
 *   - 'socket' uses "trigger" to emit events, not "emit"
 *
 *  @author Edouard Lafargue, ed@lafargue.name
 */

// This detects whether we are in a server situation and act accordingly:
if (typeof define !== 'function') {
    var define = require('amdefine')(module);
    var vizapp = { type: 'server'},
    events = require('events'),
    dbs = require('pouch-config');
}

define(function (require) {
    "use strict";

    var Serialport = require('serialport'),
        serialConnection = require('connections/serial'),
        tcpConnection = require('connections/tcp'),
        btConnection = require('connections/btspp'),
        abu = require('app/lib/abutils');

        // Server mode does not support remote protocol (not really needed)
        if (vizapp.type != 'server')
           var Protocol = require('app/lib/jsonbin');


    var parser = function (socket) {

        var socket = socket,
            self = this;
        var serialport = null;
        var livePoller = null; // Reference to the live streaming poller
        var streaming = false,
            port = null,
            proto = 0,
            port_close_requested = false,
            port_open_requested = true,
            isopen = false;

        var bytes_expected = 0;
        var watchDog = null;
        var radio_on = true;
        var radio_mode = '';

        var temp_mem = '';


        var modes = ['FM', 'NFM', 'AM'];
        var tones = [ 67, 69.3 ,71.9 ,74.4, 77, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8, 97.4, 100, 103.5, 107.2, 110.9, 114.8 ,118.8,
                    123, 127.3, 131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 162.2, 167.9, 173.8, 179.9, 186.2, 192.8, 203.5, 206.5,
                    210.7, 218.1, 225.7, 229.1, 233.6, 241.8, 250.3, 254.1];
        var dcs_codes = [ 23,25,26,31,32,36,43,47,51,53,54,65,71,72,73,74,114,115,116,122,125,131,132,
                        134,143,145,152,155,156,162,165,172,174,205,212,223,225,226,243,244,245,246,251,252,255,261,
                        263,265,266,271,274,306,311,315,325,331,332,343,346,351,356,364,365,371,411,412,413,423,431,
                        432,445,446,452,454,455,462,464,465,466,503,506,516,523,565,532,546,565,606,612,624,627,631,
                        632,654,662,664,703,712,723,731,732,734,743,754
                        ];
        var duplex_options = [ 'Off', '+', '-', 'Split'];
        var sql_modes = [ 'None', 'Tone', 'CTCSS', 'DCS'];
        var tune_steps = [ '5.0', '6.25', '8.33', '10.0', '12.5', '15.0', '20.0', '25.0', '30.0', '50.0', '100.0'];


        // We want to keep track of radio operating values and only send them to the
        // front-end if they change
        var vfoa_sql = -1;
        var vfob_sql = -1;
        var vfoa_freq = '';
        var vfob_freq = '';

        // We need the model ID to accomodate for the various radio model
        /// variants. The ID is requested upon driver open.
        var model_id = 'Unknown';

        // We need to manage a command queue, because we
        // cannot tell what the data in means if we don't know
        // the command that was sent. The joys of async programming.
        var commandQueue = [],
            queue_busy = false;

        // Keep track of TX/RX state so that we can adjust the
        // status command
        var tx_status = false;
        var qc = 0; // Query counter

        /////////////
        // Private methods
        /////////////

        // TODO: Implement autodetect
        var portSettings = function () {
            return {
                baudRate: 9600,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                dtr: false,
                flowControl: true,
                // We get non-printable characters on some outputs, so
                // we have to make sure we use "binary" encoding below,
                // otherwise the parser will assume Unicode and mess up the
                // values.
                parser: new Serialport.parsers.Readline({ delimiter:'\r', encoding:'binary'})
            }
        };

        // Format can act on incoming data from the radio, and then
        // forwards the data to the app through a 'data' event.
        //
        // data is a string
        var format = function (data) {

            if (proto) {
                // We are using the Wizkers Netlink protocol, so incoming data has to be forwarded
                // to our protocol handler and we stop processing there, the actual data will come in
                // throuth the onProtoData callback (see below)
                proto.read(data);
                return;
            }

            if (commandQueue.length == 0) {
                console.warn('Received data but we didn\'t expect anything', new Uint8Array(data));
                queue_busy = false;
                return;
            }

            clearTimeout(watchDog);

            if (!queue_busy) {
                console.info('We received a complete data packet but we don\'t have the queue_busy flag set');
                self.trigger('data', { raw:data });
                return;
            }

            // At this stage, we know we're expecting a value
            var cmd = commandQueue.shift();
            queue_busy = false;
            var resp = {};
            // Reformat input buffer as a string
            var ibstr = data.substr(3);
            var is_error = (data == 'N') || (data == '?');

            switch (cmd.command) {
                case 'get_frequency':
                case 'poll_frequency':
                    resp = parse_FO(ibstr, cmd.arg);
                    break;
                case 'get_sql':
                    resp = parse_BY(ibstr);
                    break;
                case 'get_menu':
                    resp = parse_MU(ibstr);
                    break;
                case 'get_power':
                    resp = parse_PC(ibstr);
                    break;
                case 'get_uid':
                    resp = { uid: ibstr };
                    break;
                case 'get_control':
                    resp = { ctrl_band: parseInt(ibstr.substr(0,1)), ptt_band: parseInt(ibstr.substr(2,1)) };
                    break;
                case 'get_memory':
                    if (is_error) {
                        // There is no memory defined at that index
                        resp = { memory: { index: cmd.arg, empty: true}};
                        commandQueue.shift(); // Remove the get_memory_name;
                    }
                    temp_mem = ibstr;
                    // Note: we are automatically getting memory name next
                    break;
                case 'get_memory_name':
                    resp = parse_MEM(ibstr);
                    break;
                case 'set_memory':
                    resp = { op: 'set_memory', index: cmd.arg.index, error: is_error};
                    console.info(resp);
                    break;
                case 'set_memory_name':
                    resp = { op: 'set_memory', index: cmd.arg.index, error: is_error};
                    break;
                case 'get_mem_channel':
                    if (!is_error) {
                        resp = { vfo :  parseInt(ibstr.substr(0,1)),
                                channel: parseInt(ibstr.substr(2,3))
                        };
                    } else {
                        resp = { channel: -1,
                            vfo: (cmd.arg == 'a' ? 0 : 1 )
                            };
                    }
                    break;
                case 'id':
                    model_id = ibstr;
                    if (model_id == '') {
                        self.output({command: 'id' });
                    } else {
                        resp = { id: model_id};
                        console.info('Identified radio model:', model_id);
                    }
                    break;
                case 'raw':
                    resp = {raw: data};
                    break;
            }
            if (Object.keys(resp) && (Object.keys(resp).length > 0)) {
                self.trigger('data', resp);
            }
            processQueue();
        };

        /**
         * Parse a MEM packet, and send it to the front-end.
         * Rule: we convert all manufacturer-specific codes into readable standard values
         * so that the front-end does not depend on a particular device brand/model as much as
         * possible.
         */
        var parse_MEM = function(str) {
            if (temp_mem.length == 0) {
                console.error('No memory reading ready!');
                return {};
            }
            var fields = temp_mem.split(',').map(function(v){return parseInt(v);});
            var mem = {
                index: fields[0],
                empty: false,
                name: str.substr(4),
                freq: fields[1],
                step: tune_steps[fields[2]],
                duplex: duplex_options[fields[3]],
                reverse: fields[4],
                tone_on: fields[5]==1,
                ct_on: fields[6]==1,
                dcs_on: fields[7]==1
            };

            // Depending on model, the fields are different:
            switch (model_id) {
                case 'TH-D72':
                    mem.tone_freq = tones[fields[9]];
                    mem.ct_freq = tones[fields[10]];
                    mem.dcs_code = dcs_codes[fields[11]];
                    mem.offset_freq = fields[13];
                    mem.mode = modes[fields[14]];
                    mem.split_freq = fields[15];
                    mem.skip = fields[17]==1;
                    break;
                case 'TM-V71':
                default:
                    mem.tone_freq = tones[fields[8]];
                    mem.ct_freq = tones[fields[9]];
                    mem.dcs_code = dcs_codes[fields[10]];
                    mem.offset_freq = fields[11];
                    mem.mode = modes[fields[12]];
                    mem.split_freq = fields[13];
                    mem.skip = fields[15]==1;
            }


            return { memory: mem };
        }

        var parse_PC = function(str) {
            var fields = str.split(',').map(function(v){return parseInt(v);});
            var resp = {};
            if (fields[0] == 0) {
                resp.vfoa_power = fields[1];
            } else {
                resp.vfob_power = fields[1];
            }
            return resp;
        }

        var parse_BY = function(str) {
            var resp = {};
            var sql = parseInt(str[2]);
            if (str[0] == '0') {
                if (sql != vfoa_sql) {
                    resp.vfoa_sql = sql;
                    vfoa_sql = sql;
                } else {
                    return {};
                }
            } else {
                if (sql != vfob_sql) {
                    resp.vfob_sql = sql;
                    vfob_sql = sql;
                } else {
                    return {};
                }
            }
            return resp;
        }


        var parse_MU = function(str) {
            var fields = str.split(',').map(function(v){return parseInt(v);});
            console.info(fields);
            var resp = {
                menu_settings: {
                    beep: fields[0],
                    beep_vol: fields[1],
                    speaker_mode: fields[2],
                    announce: fields[3],
                    lang: fields[4],
                    voice_vol: fields[5],
                    voice_speed: fields[6],
                    playback_repeat: fields[7],
                    playback_repeat_interval: fields[8],
                    cont_recording: fields[9],
                    vhf_aip: fields[10],
                    uhf_aip: fields[11],
                    smeter_hangup: fields[12],
                    mute_hangup: fields[13],
                    beat_shift: fields[14],
                    timeout_timer: fields[15],
                    recall_method: fields[16],
                    echolink_speed: fields[17],
                    dtmf_hold: fields[18],
                    dtmf_speed: fields[19],
                    dtmf_pause: fields[20],
                    dtmf_key_lock: fields[21],
                    auto_rpt_offset: fields[22],
                    tx_hold: fields[23],
                    unk1: fields[24],
                    brightness: fields[25],
                    auto_brightness: fields[26],
                    bl_color: fields[27],
                    pf1_key: fields[28],
                    pf2_key: fields[29],
                    mic_pf1_key: fields[30],
                    mic_pf2_key: fields[31],
                    mic_pf3_key: fields[32],
                    mic_pf4_key: fields[33],
                    mic_key_lock: fields[34],
                    scan_resume: fields[35],
                    apo: fields[36],
                    data_band: fields[37],
                    data_speed: fields[38],
                    sqc_source: fields[39],
                    auto_pm_store: fields[40],
                    display_bar: fields[41]
                }
            };


            return resp;
        }


        var parse_FO = function(str, vfo) {
            if ((vfo == 'a' && str == vfoa_freq) || (vfo == 'b' && str == vfob_freq))
                return {};
            if (vfo =='a')
                vfoa_freq = str;
            else
                vfob_freq = str;

            var fields = str.split(',').map(function(v){return parseInt(v);});
            var resp = {};
            var vfo_options = {
                step: fields[2],
                shift: fields[3],
                reverse: fields[4],
                tone: fields[5] ==1,
                ct: fields[6] ==1,
                dcs: fields[7] ==1,
            };

            // Depending on model, the fields are different:
            switch (model_id) {
                case 'TH-D72':
                    vfo_options.tone_freq = tones[fields[9]];
                    vfo_options.ct_freq = tones[fields[10]];
                    vfo_options.dcs_code = dcs_codes[fields[11]];
                    vfo_options.offset_freq = fields[13];
                    vfo_options.mode = modes[fields[14]];
                    break;
                case 'TM-V71':
                default:
                    vfo_options.tone_freq = tones[fields[8]];
                    vfo_options.ct_freq = tones[fields[9]];
                    vfo_options.dcs_code = dcs_codes[fields[10]];
                    vfo_options.offset_freq = fields[11];
                    vfo_options.mode = modes[fields[12]];
            }


            if (fields[0]) {
                // VFOB
                resp.vfob = fields[1];
            } else {
                resp.vfoa = fields[1];
            }
            resp.vfo_options = vfo_options;
            return resp;
        }

        /**
         * When the protocol parser gets data, this callback gets called
         */
        var onProtoData = function(data) {
            self.trigger('data', data);
        }

        var status = function (stat) {
            port_open_requested = false;
            console.log('Port status change', stat);
            if (stat.openerror) {
                // We could not open the port: warn through
                // a 'data' messages
                var resp = {
                    openerror: true
                };
                if (stat.reason != undefined)
                    resp.reason = stat.reason;
                if (stat.description != undefined)
                    resp.description = stat.description;
                self.trigger('data', resp);
                return;
            }

            isopen = stat.portopen;

            if (isopen) {
                // Should run any "onOpen" initialization routine here if
                // necessary.
                // This driver auto-detects the radio model to adapt to the small
                // differences from one model to the next, so we need to send the "ID"
                // command after open.
                self.output({command: 'id'});
            } else {
                // We remove the listener so that the serial port can be GC'ed
                if (port_close_requested) {
                    if (port.off)
                        port.off('status', status);
                    else
                        port.removeListener('status', status);
                    port_close_requested = false;
                }
            }
        };


        function queryRadio() {
            // TODO: follow radio state over here, so that we only query power
            // when the radio transmits, makes much more sense

            // This is queried every second - we stage our queries in order
            // to avoid overloading the radio, not sure that is totally necessary, but
            // it won't hurt

            if (qc++ % 3 == 0) {
                this.output({ command: 'poll_frequency', arg: 'a' });
                this.output({command:'get_mem_channel', arg: 'a'});
                this.output({ command: 'poll_frequency', arg: 'b' });
                this.output({command:'get_mem_channel', arg: 'b'});
            }

            if (qc % 4 == 0) {
                this.output({command:'get_control'});
                this.output({command:'get_power', arg: 'a'});
                this.output({command:'get_power', arg: 'b'});
            }

            this.output({ command: 'get_sql', arg:'a'});
            this.output({ command: 'get_sql', arg:'b'});

        };

        // Process the latest command in the queue
        var processQueue = function() {
            if (queue_busy || (commandQueue.length == 0))
                return;
            queue_busy = true;
            var cmd = commandQueue[0]; // Get the oldest command
            // console.log(cmd);
            // Note: UInt8Arrays are initialized at zero
            var cmd_string = "";
            switch(cmd.command) {
                case 'set_frequency':
                    cmd_string = make_VFO(cmd.arg, true);
                    if (cmd_string == undefined) {
                        console.error('Bad argument format for set_frequency');
                        commandQueue.shift();
                        queue_busy = false;
                        return;
                    }
                    break;
                case 'set_vfo_mode':
                    cmd_string = 'VM ';
                    cmd_string += ((cmd.arg.vfo == 'a') ? '0' : '1' ) + ',';
                    cmd_string += (cmd.arg.mode == 'vfo') ? '0' : (cmd.arg.mode == 'mem') ? '1' : '2';
                    break;
                case 'get_frequency':
                    if (cmd.arg == 'a')
                        vfoa_freq = '';
                    else
                        vfob_freq = '';
                case 'poll_frequency':
                    cmd_string = 'FO ' + ((cmd.arg == 'a') ? '0' : '1');
                    break;
                case 'get_sql':
                    cmd_string = 'BY ' + ((cmd.arg == 'a') ? '0' : '1');
                    break;
                case 'get_uid':
                    cmd_string = 'AE';
                    break;
                case 'get_menu':
                    cmd_string = 'MU';
                    break;
                case 'get_power':
                    cmd_string = 'PC ' + ((cmd.arg == 'a') ? '0' : '1');
                    break;
                case 'get_control':
                    cmd_string = 'BC';
                    break;
                case 'get_memory':
                    cmd_string = 'ME ' + ('000' + cmd.arg).slice(-3);
                    break;
                case 'get_memory_name':
                    cmd_string = 'MN ' + ('000' + cmd.arg).slice(-3);
                    break;
                case 'set_memory':
                    cmd_string = make_Memory(cmd.arg);
                    if (cmd_string == undefined) {
                        console.error('Bad argument format for memory set');
                        commandQueue.shift();
                        queue_busy = false;
                        return;
                    }
                    break;
                case 'set_memory_name':
                    cmd_string = 'MN ' + ('000' + cmd.arg.index).slice(-3) + ',' + cmd.arg.name;
                    break;
                case 'set_mem_channel':
                    cmd_string = 'MR ' + ((cmd.arg.vfo == 'a') ? '0' : '1') + ',' +  ('000' + cmd.arg.channel).slice(-3);
                    break;
                case 'get_mem_channel':
                    cmd_string = 'MR ' + ((cmd.arg == 'a') ? '0' : '1');
                    break;
                case 'id':
                    cmd_string = 'ID';
                    break;
                case 'raw':
                    cmd_string = cmd.arg;
                    break;
            }

            watchDog = setTimeout( function() {
                commandQueue.shift();
                queue_busy = false;
            }, 500);
            port.write(cmd_string + '\r');
        }

        /**
         * Build a VFO set string - simpler than a memory definition
         *  vfo is a JSON object describing the VFO structure
         *  isCall is a Bool that indicates we want a "CC" and not "FO" comand
         */
        var make_VFO = function(vfo, isCall) {

            if (vfo.band != 'a' && vfo.band != 'b')
                return;
            var r = (isCall) ? 'CC ' : 'FO ';
            r += ((vfo.band == 'a') ? '0' : '1' ) + ',';
            // Mem freq (in Hertz)
            var f = vfo.freq;
            if (isNaN(f))
                return;
            r += ('0000000000' + f).slice(-10) + ',';

            // Mem Step. We pick it automatically
            if (f % 5000 != 0) {
                if (f % 6250 == 0) {
                    r += '1,';
                } else if (f % 8330 == 0) {
                    r += '2,';
                } else if (f % 12500 == 0) {
                    r += '4';
                }
            } else {
                r += '0,';
            }

            // Mem Shift direction
            switch (vfo.duplex) {
                case 'Off':
                case 'Split':
                    r += '0,';
                    break;
                case '+':
                    r += '1,';
                    break;
                case '-':
                    r += '2,';
                    break;
            }

            // Mem reverse (???)
            r += '0,';

            // Tone on/off
            r += (vfo.tone_on ? '1' : '0') + ',';

            // CT on/off
            r += (vfo.ct_on ? '1' : '0') + ',';

            // DCS on/off
            r += (vfo.dcs_on ? '1' : '0') + ',';

            if (vfo.tone_on) {
                // Tone freq
                var i = tones.indexOf(vfo.tone_freq);
                if (i == -1) {
                    console.error("Wrong tone code");
                    return;
                }
                r += ('00' + i).slice(-2) + ',';
            } else {
                r += '00,';
            }

            if (vfo.ct_on) {
                // CT freq
                i = tones.indexOf(vfo.ct_freq);
                if (i == -1) {
                    console.error("Wrong CTCSS code");
                    return;
                }
                r += ('00' + i).slice(-2) + ',';
            } else {
                r += '00,';
            }

            if (vfo.dcs_on) {
                // DCS code
                i = dcs_codes.indexOf(parseInt(vfo.dcs_code));
                if (i == -1) {
                    console.error("Wrong DCS code");
                    return;
                }
                r += ('000' + i).slice(-3) + ',';
            } else {
                r += '000,';
            }

            // Offset freq (MHz)
            var offset = Math.abs(parseFloat(vfo.offset_freq));
            if (isNaN(offset))
                return;
            r += ('00000000' + offset).slice(-8) + ',';

            // Mode
            i = modes.indexOf(vfo.mode);
            if (i == -1) {
                console.error("Wrong Mode code");
                return;
            }
            r += i;

            if (isCall) {
                r += ',0000000000,0';
            }

            return r;
        }

        /**
         * Build a memory set string. Error checking is built-in.
         * Note: we are getting instrument-agnostic values there, which we convert into
         * our own Kenwood values.
         *
         * Note: each Kenwood model requires slightly different syntax here
         */
        var make_Memory = function(mem) {
            var r = 'ME ';

            // Mem index
            var idx = mem.index;
            if (idx < 0 || idx > 999)
                return;
            r += ('000' + idx).slice(-3) + ',';

            // Mem freq (in Hertz)
            var f = mem.freq;
            if (isNaN(f))
                return;
            r += ('0000000000' + f).slice(-10) + ',';

            // Mem Step. We are trying to be a bit smart here, and
            // depending on the frequency, we are adjusting
            // the step there so that the radio accepts the frequency.
            // Otherwise, we just pick the step the user wants
            if (f % (mem.step*1000) != 0) {
                if (f % 6250 == 0) {
                    r += '1,';
                } else if (f % 8330 == 0) {
                    r += '2,';
                } else if (f % 12500 == 0) {
                    r += '4';
                }
            } else {
                r += tune_steps.indexOf(mem.step) + ',';
            }

            // Mem Shift direction
            switch (mem.duplex) {
                case 'Off':
                case 'Split':
                    r += '0,';
                    break;
                case '+':
                    r += '1,';
                    break;
                case '-':
                    r += '2,';
                    break;
            }

            // Mem reverse (???)
            r += '0,';
            // Tone on/off
            r += (mem.tone_on ? '1' : '0') + ',';

            // CT on/off
            r += (mem.ct_on ? '1' : '0') + ',';

            // DCS on/off
            r += (mem.dcs_on ? '1' : '0') + ',';

            if (model_id == 'TH-D72')
                r += '0,';  // Unknown

            // Tone freq
            var i = tones.indexOf(mem.tone_freq);
            if (i == -1) {
                console.error("Wrong tone code");
                return;
            }
            r += ('00' + i).slice(-2) + ',';

            // CT freq
            i = tones.indexOf(mem.ct_freq);
            if (i == -1) {
                console.error("Wrong CTCSS code");
                return;
            }
            r += ('00' + i).slice(-2) + ',';

            // DCS code
            i = dcs_codes.indexOf(parseInt(mem.dcs_code));
            if (i == -1) {
                console.error("Wrong DCS code");
                return;
            }
            r += ('000' + i).slice(-3) + ',';

            if (model_id == 'TH-D72')
                r += '0,';  // Unknown

            // Offset freq (MHz)
            var offset = Math.abs(parseFloat(mem.offset_freq));
            if (isNaN(offset))
                return;
            if (mem.mode == "split") {
                r += '00000000';
            } else {
                r += ('00000000' + offset).slice(-8) + ',';
            }

            // Mode
            i = modes.indexOf(mem.mode);
            if (i == -1) {
                console.error("Wrong Mode code");
                return;
            }
            r += i + ',';

            // 0 (10 digits)
            // Used when we are doing "split" or "odd frequency repeaters"
            if (mem.mode == "split") {
                r += ('0000000000' + offset).slice(-10) + ',';
            } else {
                r += '0000000000,';
            }

            // 0 (Unknown)
            r += '0,';
            // Memory lockout (0)
            // (Memory skip during scan)
            r += '0';

            console.info('Memory string:', r);

            return r;
        };

        var openPort_server = function(insid) {
            dbs.instruments.get(insid, function(err,item) {
                port = new serialConnection(item.port, portSettings());
                port.on('data', format);
                port.on('status', status);
                port.open();
            });
        };

        var openPort_app = function(insid) {
            var ins = instrumentManager.getInstrument();
            // We now support serial over TCP/IP sockets: if we detect
            // that the port is "TCP/IP", then create the right type of
            // tcp port:
            var p = ins.get('port');
            if (p == 'TCP/IP') {
                // Note: we just use the parser info from portSettings()
                port = new tcpConnection(ins.get('tcpip'), portSettings().parser);
            } else if (p == 'Wizkers Netlink') {
                port = new tcpConnection(ins.get('netlink'), portSettings().parser);
                proto = new Protocol();
                proto.on('data', onProtoData);
            } else if (p == 'Bluetooth') {
                port = new btConnection(ins.get('btspp'), portSettings().parser);
            } else {
                port = new serialConnection(ins.get('port'), portSettings());
            }
            port.on('data', format);
            port.on('status', status);
            port.open();
        }


        /////////////
        // Public methods
        /////////////

        this.openPort = function (insid) {
            port_open_requested = true;
            if (vizapp.type == 'server') {
                openPort_server(insid);
            } else {
                openPort_app(insid);
            }
        };

        this.closePort = function (data) {
            // We need to remove all listeners otherwise the serial port
            // will never be GC'ed
            if (port.off)
                port.off('data', format);
            else
                port.removeListener('data', format);
            if (proto)
                proto.off('data', onProtoData);

            // If we are streaming, stop it!
            // The Home view does this explicitely, but if we switch
            // instrument while it is open, then it's up to the driver to do it.
            if (streaming)
                this.stopLiveStream();

            port_close_requested = true;
            port.close();
        }

        this.isOpen = function () {
            return isopen;
        }

        this.isOpenPending = function () {
            return port_open_requested;
        }

        this.getInstrumentId = function (arg) {};

        this.isStreaming = function () {
            return streaming;
        }

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // Returns the Radio serial number.
        this.sendUniqueID = function () {
            this.uidrequested = true;
            this.output({command:'get_uid'});
        };

        // period in seconds
        this.startLiveStream = function (period) {
            var self = this;
            vfoa_sql = -1;
            vfob_sql = -1;
            vfoa_freq = '';
            vfob_freq = '';

            if (proto) {
                // We are connected to a remote Wizkers instance using Netlink,
                // and that remote instance is in charge of doing the Live Streaming
                streaming = true;
                // We push this as a data message so that our output plugins (Netlink in particular)
                // can forward this message to the remote side. In the case of Netlink (remote control),
                // this enables the remote end to start streaming since it's their job, not ours.
                port.write("@N3TL1NK,start_stream;");
                return;
            }

            this.output({command:'get_menu'});
            this.output({command:'get_control'});
            this.output({command:'get_power', arg: 'a'});
            this.output({command:'get_power', arg: 'b'});

            if (!streaming) {
                console.log("[TM-V71A] Starting live data stream");
                livePoller = setInterval(queryRadio.bind(this), 500);
                streaming = true;
            }
        };

        this.stopLiveStream = function (args) {
            if (proto) {
                streaming = false;
                port.write("@N3TL1NK,stop_stream;");
                return;
            }
            if (streaming) {
                console.log("[TM-V71A] Stopping live data stream");
                // Stop live streaming from the radio:
                port.write('');
                clearInterval(livePoller);
                streaming = false;
            }
        };

        // Outputs receives the commands from the upper level driver
        // Data should be a JSON object:
        // { command: String, args: any};
        // Command can be:
        //  id              : identify the rig type
        //  get_frequency   : 'a' or 'b'
        //  poll_frequency  : same as get, except that if frequency
        //                    didn't change, won't send an update
        //  set_frequency   : sets VFOA or VFOB, arg is a json with VFO description
        //  get_uid         : Get the serial number of the rig
        //  get_menu        : get the V71A menu settings (one command)
        //  raw             : send a raw string to V71. arg is the actual string
        //  get_memory      : get a memory, arg is the memory number (0 to 999)
        //                    this command also queries the name
        //  set_memory      : Saves a memory, arg is a json with memory description
        //  get_tones       : returns array of all supported tones
        //  set_mem_channel : tune to memory channel in arg
        //  get_mem_channel : ask radio about channel displayed on vfo in arg ('a' or 'b')
        this.output = function (data) {

            if (typeof data != 'object') {
                if (data.indexOf("@N3TL1NK,start_stream;") > -1) {
                    this.startLiveStream();
                    return;
                } else if (data.indexOf("@N3TL1NK,stop_stream;") > -1) {
                    this.stopLiveStream();
                    return;
                }
                return;
            }
            if (data.command == undefined) {
                console.error('[tm-v71a output] Missing command key in output command');
                return;
            }
            // Take care of driver commands (those don't speak to the radio)
            if (data.command == 'get_tones') {
                this.trigger('data', {tones: tones});
                return;
            }
            if (data.command == 'get_dcs_codes') {
                this.trigger('data', {dcs_codes: dcs_codes});
                return;
            }
            if (data.command == 'set_frequency') {
                // Special case: we need to make sure the radio
                // is in CALL mode first, the only mode than allows complete
                // control on the frequency
                commandQueue.push({command:'set_vfo_mode', arg: { vfo: data.arg.band, mode: 'call'}});
            }
            if (data.command == 'set_mem_channel') {
                // Make sure we are in channel mode first:
                commandQueue.push({command:'set_vfo_mode', arg: { vfo: data.arg.vfo, mode: 'mem'}});
            }

            commandQueue.push(data);
            // Special case for get_memory:
            if (data.command == 'get_memory') {
                commandQueue.push({command: 'get_memory_name', arg: data.arg});
            }
            if (data.command == 'set_memory') {
                commandQueue.push({command: 'set_memory_name', arg: data.arg});
            }


            processQueue();
        };

    }

    // On server side, we use the Node eventing system, whereas on the
    // browser/app side, we use Bacbone's API:
    if (vizapp.type != 'server') {
        // Add event management to our parser, from the Backbone.Events class:
        _.extend(parser.prototype, Backbone.Events);
    } else {
        parser.prototype.__proto__ = events.EventEmitter.prototype;
        parser.prototype.trigger = parser.prototype.emit;
    }

    return parser;
});