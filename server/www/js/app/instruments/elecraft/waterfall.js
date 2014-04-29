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
        tpl     = require('text!tpl/instruments/AudioWaterfall.html'),
        template = null;
        
        try {
            template = _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            template = require('js/tpl/instruments/AudioWaterfallView.js', function(){} , function(err) {
                            console.log("Compiled JS preloading error callback.");
                            });
        }

    return Backbone.View.extend({

        render:function () {
            $(this.el).html(template());
            return this;
        }

    });
});
