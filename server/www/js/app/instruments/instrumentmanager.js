/**
 *
 * The Instrument manager handles all interactions with the various instruments.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    
    "use strict";
    
    var _ = require('underscore'),
        Backbone = require('backbone'),
        Instrument = require(['app/models/instrument']);

    var OnyxInstrument = require('app/instruments/onyx/onyx'),
        OnyxSettingsView = require('app/instruments/onyx/settings');

    var FCOledInstrument = require('app/instruments/fcoledv1/fcoled'),
        FCOledSettingsView = require('app/instruments/fcoledv1/settings');

    var W433Instrument = require('app/instruments/w433/w433'),
        W433SettingsView = require('app/instruments/w433/settings');

    var ElecraftInstrument = require('app/instruments/elecraft/elecraft'),
        ElecraftSettingsView = require('app/instruments/elecraft/settings');
    
    var Fluke289Instrument = require('app/instruments/fluke28x/fluke'),
        Fluke289SettingsView = require('app/instruments/fluke28x/settings');
    
    var USBGeigerInstrument = require('app/instruments/usbgeiger/usb_geiger'),
        USBGeigerInstrumentSettingsView = require('app/instruments/usbgeiger/settings');
    

    var InstrumentManager = function() {
    
        // current_instrument is a Backbone Model instance
        var current_instrument = null; // The instrument currently in use

        this.supportedInstruments = {
            "onyx":     { name: "SafeCast Onyx", type: OnyxInstrument, settings: OnyxSettingsView},
            "fcoledv1": { name: "Fried Circuits OLED backpack", type: FCOledInstrument, settings: FCOledSettingsView },
            "elecraft": { name: "Elecraft radios", type: ElecraftInstrument, settings:ElecraftSettingsView },
            "usbgeiger":{ name: "USB Geiger Dongle", type: USBGeigerInstrument, settings: USBGeigerInstrumentSettingsView },
            "fluke28x" :{ name: "Fluke 287/289 Series multimeter", type:Fluke289Instrument, settings: Fluke289SettingsView}
        };
        
        // The instruments below are not supported in Cordova or Chrome runmodes:
        if (vizapp.type == "server") {
            this.supportedInstruments["w433"] =
                { name: "Aerodynes W433 Weather receiver", type: W433Instrument, settings: W433SettingsView };
        }
        
        this.clear = function() {
            current_instrument = null;
        }

        this.setInstrument = function(instrument) {
            var type = instrument.get('type');
            for (var ins in this.supportedInstruments) {
            if (ins == type) {
                current_instrument = instrument;
                // Nifty: we extend our instrument manager with the methods of our instrument.
                // (since all instruments support the same API, a change of instrument
                // overrides the methods)
                var instrumentObject =new this.supportedInstruments[ins].type;
                _.extend(this,instrumentObject);
                linkManager.setDriver(this.getDriver());

                this.trigger('instrumentChanged'); // Tell views who rely on the instrument manager...
                }
            }
        }
        
        this.startUploader = function() {
            linkManager.setUploader(this.getUploader());
        }
        
        this.stopUploader = function() {
            linkManager.setDriver(this.getDriver());
        };

        // Get the currently loaded instrument
        this.getInstrument = function() {
            return current_instrument;
        }
        
    };

    _.extend(InstrumentManager.prototype, Backbone.Events);
    
    return InstrumentManager;

});