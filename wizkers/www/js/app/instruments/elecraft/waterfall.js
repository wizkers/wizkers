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
 * A simple waterfall using the web audio API. Does not (yet)
 * support remote audio, this is a visualisation that uses the local
 * microphone only.
 
 * @author Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
define(function (require) {

    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        Snap = require('snap'),
        DSP = require('dsp'),
        chroma = require('chroma'),
        resampler = require('resampler'),
        template = require('js/tpl/instruments/AudioWaterfall.js');

    // Need to load these, but no related variables.
    require('bootstrap');
    require('bootstrapslider');

    // Load out WebRTC adapter and PeerJS
    require('webrtc_adapter');
    require('peerjs');

    // Define a few fundamental API calls:
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;


    // Utility functions
    var scriptNodes = {};
    var keep = (function () {
        var nextNodeID = 1;
        return function (node) {
            node.id = node.id || (nextNodeID++);
            scriptNodes[node.id] = node;
            return node;
        };
    }());

    function drop(node) {
        delete scriptNodes[node.id];
        return node;
    }


    // All our state variables in the context of this object's closure, makes
    // the code much cleaner (no tons of "this" and "self" everywhere:
    var gain = 45;
    var floor = 40;
    var sampleRate = 8820;
    var maxAvg = 1;
    var fftWindow = DSP.HAMMING;

    // Audio nodes used in the analyser:
    var context = null;
    var sourceNode = null;
    var filterNode = null;
    var resamplerNode = null;
    var fft = null;
    var spectrumbuffer = [ ];

    // Graphical pointers
    var canvas = null;
    var tempCanvas = null;
    var ctx = null;
    var ctx2 = null;
    var tempCtx = null;

    // State variables
    var monitoring = false;
    var running = false;

    // used for color distribution
    var hot = new chroma.scale(['#000000', '#0B16B5', '#FFF782', '#EB1250']).domain([0, 300]).out('hex');

    return Backbone.View.extend({


        initialize: function () {

            this.audioDevice = this.model.get('audio_input');
        },

        render: function () {

            var self = this;

            this.$el.html(template());

            $("#xtrafunc-popin", this.el).hide();

            // get the context from the canvas to draw on
            ctx = $("#spectrum-canvas").get()[0].getContext("2d");
            ctx2 = $("#wf-canvas").get()[0].getContext("2d");

            // create a temp canvas we use for copying
            tempCanvas = document.createElement("canvas");
            tempCtx = tempCanvas.getContext("2d");
            tempCanvas.width = 1024;
            tempCanvas.height = 256;

            canvas = $("#wf-canvas", this.el)[0];

            var paper = Snap("#graticule");
            Snap.load("img/graticule.svg", function (f) {
                paper.add(f);
            });

            $("#graticule").resize(function (e) {
                $("#graticule").height($("#graticule").width() * 0.5);
                $("#spectrum-canvas").width($("#graticule").width());
                $("#wf-canvas").width($("#graticule").width());
            });

            $("#graticule").height($("#graticule").width() * 0.5);
            $("#spectrum-canvas").width($("#graticule").width());
            $("#wf-canvas").width($("#graticule").width());

            $("#gain-control", this.el).slider();
            $("#floor-control", this.el).slider();

            // Get slider value changes:
            $("#gain-control").slider().on('slideStop', function () {
                gain = this.value;
            });

            $("#floor-control").slider().on('slideStop', function () {
                floor = this.value;
            });

            $("#wf-samprate").change(function () {
                var table = {
                    "44.1 kHz": 44100,
                    "22.05 kHz": 22050,
                    "11.025 kHz": 11025,
                    "8.82 kHz": 8820
                }
                sampleRate = table[this.value];
                // Now reinit our whole chain: delete everything and restart
                sourceNode.disconnect();
                filterNode.disconnect();
                resamplerNode.disconnect();
                // delete cl.filterNode;
                drop(resamplerNode);
                self.initResampler();
                if (monitoring)
                    filterNode.connect(context.destination);
            });

            $("#wf-fftwindow").change(function () {
                var table = {
                    "Hamming": DSP.HAMMING,
                    "Hann": DSP.HANN,
                    "Bartlett": DSP.BARTLETT,
                    "Bartlett-Hann": DSP.BARTLETTHANN,
                    "Blackman": DSP.BLACKMAN,
                    "Cosine": DSP.COSINE,
                    "Gauss": DSP.GAUSS,
                    "Lanczos": DSP.LANCZOS,
                    "Rectangular": DSP.RECTANGULAR,
                    "Triangular": DSP.TRIANGULAR
                };
                self.fftWindow = table[this.value];
                sourceNode.disconnect();
                filterNode.disconnect();
                resamplerNode.disconnect();
                // delete filterNode;
                drop(resamplerNode);
                self.initResampler();
                if (monitoring)
                    filterNode.connect(context.destination);
            });

            $("#wf-smoothing").change(function () {
                maxAvg = parseInt(this.value);

            });

            return this;
        },

        events: {
            "click #wf-popout": "popout",
            "click #wf-popin": "popin",
            "click #wf-start": "initaudio",
            "click #wf-audiomonitor": "togglemonitor",
        },

        popout: function () {
            if (running)
                this.initaudio();
            window.open('/waterfall.html');
            $("#xtrafunc-wf").hide();
            $("#xtrafunc-leftside").removeClass('col-md-7').addClass('col-md-11');
            $("#xtrafunc-rightside").removeClass('col-md-5').addClass('col-md-1');
            $("#xtrafunc-popin").show();
        },

        popin: function () {
            $("#xtrafunc-popin").hide();
            $("#xtrafunc-leftside").removeClass('col-md-11').addClass('col-md-7');
            $("#xtrafunc-rightside").removeClass('col-md-1').addClass('col-md-5');
            $("#xtrafunc-wf").show();
        },

        togglemonitor: function () {
            if (!monitoring) {
                filterNode.connect(context.destination);
                $("#wf-audiomonitor").removeClass('btn-default').addClass('btn-success');
            } else {
                filterNode.disconnect();
                filterNode.connect(resamplerNode);
                $("#wf-audiomonitor").removeClass('btn-success').addClass('btn-default');
            }
            monitoring = !monitoring;
        },

        initaudio: function () {
            var self = this;

            if (running && sourceNode) {
                // Stop:
                sourceNode.disconnect();
                filterNode.disconnect();
                resamplerNode.disconnect();
                drop(resamplerNode);
                running = false;
                monitoring = false;
                $("#wf-start").removeClass('btn-success').addClass('btn-default');
                $("#wf-audiomonitor").removeClass('btn-success').addClass('btn-default');
                if (this.audioDevice == 'webrtc') {
                    // Hang up
                    if (this.webRTCPeer) {
                        this.webRTCPeer.destroy();
                    }
                }
            } else {
                if (this.audioDevice == 'webrtc') {
                    // Our audio is coming in from a WebRTC stream: we have all the
                    // peer info in our settings, we just need to initiate the call
                    // Create a new Peer with our demo API key, with debug set to true so we can
                    // see what's going on.
                    var settings = this.model.get('webrtc');
                    this.webRTCPeer = new Peer({
                        host: settings.host,
                        port: settings.port,
                        debug: 3
                    });

                    // TODO: Add additional user feedback during call progression, and
                    //       in any case if call does not succeed.
                    var audioConstraints = {
                        audio: {
                            echoCancellation: false,
                            deviceId: this.model.get('op_audio_input')
                        }
                    };

                    navigator.getUserMedia(audioConstraints,
                        function success(audioStream) {
                            var call = self.webRTCPeer.call('webrtc-wizkers', audioStream);
                            call.on('stream', function (stream) {
                                console.log('Incoming media stream');
                                fft = new FFT(2048, sampleRate);
                                // Create an AudioNode from the stream (live input)
                                // Note: there is a pretty bad Chrome limitation at the moment,
                                // which prevents remote WebRTC audio streams to be connected to
                                // the webaudio API (the webaudio api just gets an empty stream :(
                                // https://code.google.com/p/chromium/issues/detail?id=121673
                                $('#wf-display').empty(); // Remove the waterfall
                                var audio = $('<audio id="aud" controls autoplay></audio>').appendTo('#wf-display');
                                audio[0].src = (URL || webkitURL || mozURL).createObjectURL(stream);
                                // Let's see if this starts working one day:
                                if (context) {
                                    context.close().then(function () {
                                        context = new AudioContext();
                                        sourceNode = context.createMediaStreamSource(stream);
                                        self.initResampler();
                                    }).catch(function (err) {
                                        console.log(err);
                                    });
                                } else {
                                    context = new AudioContext();
                                    sourceNode = context.createMediaStreamSource(stream);
                                    self.initResampler();
                                }
                            });
                        },
                        function error(err) {
                            console.log(err);
                        });
                } else {
                    // Since Chrome M36, we need to add "echoCancellation" otherwise the audio
                    // is totally distorted as Chrome now uses webaudio and webrtc in a more consistant
                    // manner, see https://code.google.com/p/chromium/issues/detail?id=397959
                    var audioConstraints = {
                        audio: {
                            echoCancellation: false,
                            deviceId: this.audioDevice
                        }
                    };

                    if (sourceNode == null) {
                        try {
                            var i = function () {
                                context = new AudioContext();
                                navigator.getUserMedia(audioConstraints, function (stream) {
                                    fft = new FFT(2048, sampleRate);
                                    // Create an AudioNode from the stream (live input)
                                    sourceNode = context.createMediaStreamSource(stream);
                                    self.initResampler();
                                }, function (err) {
                                    console.log('Get User Media Failure: ' + err);
                                });
                            }
                            if (context) {
                                context.close().then(i).catch(function (err) {
                                    console.log(err)
                                });
                            } else {
                                i();
                            }
                        } catch (e) {
                            console.log('webkitGetUserMedia threw exception :' + e);
                        }
                    } else {
                        self.initResampler();
                    }
                }
                running = true;
                $("#wf-start").removeClass('btn-default').addClass('btn-success');
            }
        },

        initResampler: function () {

            var self = this;
            // Before anything, do a low band-pass filter before resampling,
            // otherwise we'll get junk above the sampling freq.
            filterNode = context.createBiquadFilter();
            filterNode.type = filterNode.LOWPASS; // Low pass
            filterNode.frequency.value = 22050;
            filterNode.Q.value = 0.5;

            sourceNode.connect(filterNode);

            // Create an audio resampler:
            resamplerNode = keep(context.createScriptProcessor(4096, 1, 1));
            resamplerNode.onaudioprocess = (function () {
                var rss = new Resampler(44100, sampleRate, 1, 4096, true);
                var ring = new Float32Array(4096);
                var fftbuffer = new Float32Array(2048);
                var idx = 0;
                var spectrumidx = 0;
                var dspwindow = new WindowFunction(fftWindow);

                return function (event) {
                    var inp, out;
                    //console.log(event);
                    inp = event.inputBuffer.getChannelData(0);
                    out = event.outputBuffer.getChannelData(0);
                    var l = rss.resampler(inp);

                    for (var i = 0; i < l; i++) {
                        ring[(i + idx) % 4096] = rss.outputBuffer[i];
                    }

                    // Now copy the oldest 2048 bytes from ring buffer to the output channel
                    for (var i = 0; i < 2048; i++) {
                        fftbuffer[i] = ring[(idx + i + 2048) % 4096];

                    }
                    idx = (idx + l) % 4096;
                    // Before doing our FFT, we apply a window to attenuate frequency artifacts,
                    // otherwise the spectrum will bleed all over the place:
                    dspwindow.process(fftbuffer);

                    fft.forward(fftbuffer);
                    spectrumbuffer[spectrumidx] = new Float32Array(fft.spectrum);
                    spectrumidx = (spectrumidx + 1) % maxAvg;
                    requestAnimationFrame(self.drawSpectrogram);
                };
            }());

            filterNode.connect(resamplerNode);
            resamplerNode.connect(context.destination); // Bogus (output data is zero) but otherwise the script node won't process.
        },

        drawSpectrogram: function () {

            // Waterfall clear/buffer
            tempCtx.drawImage(canvas, 0, 0, 1024, 256);

            // Spectrogram clear:
            ctx.clearRect(0, 0, 1024, 256);
            ctx.beginPath();
            ctx.moveTo(0, 256);

            // Each pixel is 4500/1024 = 4.39Hz wide
            // iterate over the elements from the array
            for (var i = 0; i < 1024; i++) {
                // draw each pixel with the specific color
                var sp = 0;
                for (var j = 0; j < maxAvg; j++) {
                    sp += spectrumbuffer[j][i];
                }
                var value = 256 + gain * Math.log(sp / maxAvg * floor);
                // draw the line on top of the canvas
                ctx2.fillStyle = hot(value);
                ctx2.fillRect(i, 1, 1, 1);
                if (!(i % 4)) {
                    // ctx.fillRect(i,256-value,3,256);
                    ctx.lineTo(i, 256 - value);
                    ctx.stroke();
                }
            }
            // draw the copied image
            ctx2.drawImage(tempCanvas, 0, 0, 1024, 256, 0, 1, 1024, 256);

        },

    });
});