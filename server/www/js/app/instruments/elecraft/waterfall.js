/**
 * A simple waterfall using the web audio API. Does not (yet)
 * support remote audio, this is a visualisation that uses the local
 * microphone only.
 
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 */
define(function(require) {
    
    "use strict";
    
    var $        = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        Snap    = require('snap'),
        DSP     = require('dsp'),
        chroma  = require('chroma'),
        resampler= require('resampler'),
        tpl     = require('text!tpl/instruments/AudioWaterfall.html'),
        template = null;
    
        // Need to load these, but no related variables.
        require('bootstrap');
        require('bootstrapslider');

        
        try {
            template = _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            template = require('js/tpl/instruments/AudioWaterfallView.js', function(){} , function(err) {
                            console.log("Compiled JS preloading error callback.");
                            });
        }

    return Backbone.View.extend({
        
        
        initialize: function() {
            // Our variables:    
            var context;
            var audioBuffer;
            var sourceNode;
            var filterNode;
            var resamplerNode;
            var monitoring = false;
            var gain=45;
            var floor = 40;

            // Where we are storing the results of the FFT
            var spectrumbuffer =  [ ];
            var maxAvg = 1;
            var sampleRate = 44100;
            var fft = null;
            var fftWindow = DSP.HAMMING;

        },

        render:function () {
            $(this.el).html(template());
            
            $("#xtrafunc-popin", this.el).hide();
            
            // get the context from the canvas to draw on
            var ctx = $("#spectrum-canvas").get()[0].getContext("2d");
            var ctx2 = $("#wf-canvas").get()[0].getContext("2d");

            // create a temp canvas we use for copying
            var tempCanvas = document.createElement("canvas"),
                tempCtx = tempCanvas.getContext("2d");
            tempCanvas.width=1024;
            tempCanvas.height=256;
            
            var paper = Snap("#graticule");
            Snap.load("img/graticule.svg", function (f) {
                paper.add(f);
            });
            // I was not able to make the SVG resize gracefully, so I have to do this
            // Somehow, in this code I cannot do $("#graticule").resize(), the event
            // never fires ???
            
            $("#graticule").resize(function(e) {
                $("#graticule").height($("#graticule").width()*0.5);
                $("#spectrum-canvas").width($("#graticule").width());
                $("#wf-canvas").width($("#graticule").width());

            });

            $("#graticule").height($("#graticule").width()*0.5);
            $("#spectrum-canvas").width($("#graticule").width());
            $("#wf-canvas").width($("#graticule").width());

            $("#gain-control", this.el).slider();
            $("#floor-control", this.el).slider();
            
            return this;
        },
        
        events: {
            "click #wf-popout": "popout",
            "click #wf-popin": "popin",
        },
        
        popout: function() {
            window.open('/waterfall.html');
            $("#xtrafunc-wf").hide();
            $("#xtrafunc-leftside").removeClass('col-md-7').addClass('col-md-11');
            $("#xtrafunc-rightside").removeClass('col-md-5').addClass('col-md-1');
            $("#xtrafunc-popin").show();
        },
        
        popin: function() {
            $("#xtrafunc-popin").hide();
            $("#xtrafunc-leftside").removeClass('col-md-11').addClass('col-md-7');
            $("#xtrafunc-rightside").removeClass('col-md-1').addClass('col-md-5');
            $("#xtrafunc-wf").show();
        }

    });
});
