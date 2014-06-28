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
        OnyxInstrument = require('app/instruments/onyx/onyx'),
        OnyxSettingsView = require('app/instruments/onyx/settings'),
        Fluke289Instrument = require('app/instruments/fluke289/fluke'),
        Fluke289SettingsView = require('app/instruments/fluke289/settings'),
        FCOledInstrument = require('app/instruments/friedcircuits_oled/fcoled'),
        FCOledSettingsView = require('app/instruments/friedcircuits_oled/settings'),
        W433Instrument = require('app/instruments/w433/w433'),
        W433SettingsView = require('app/instruments/w433/settings'),
        ElecraftInstrument = require('app/instruments/elecraft/elecraft'),
        ElecraftSettingsView = require('app/instruments/elecraft/settings'),

    InstrumentManager = function() {
    
        this.instrument = null; // A Backbone Model

        this.supportedInstruments = {
            "onyx":     { name: "SafeCast Onyx", type: OnyxInstrument, settings: OnyxSettingsView},
            "fluke28x": { name: "Fluke 287/289 Series multimeter", type:Fluke289Instrument, settings: Fluke289SettingsView},
            "fcoledv1": { name: "Fried Circuits OLED backpack", type: FCOledInstrument, settings: FCOledSettingsView },
            "w433":     { name: "Aerodynes W433 Weather receiver", type: W433Instrument, settings: W433SettingsView },
            "elecraft": { name: "Elecraft radios", type: ElecraftInstrument, settings:ElecraftSettingsView },
        };

        this.setInstrument = function(instrument) {
            var type = instrument.get('type');
            for (var ins in this.supportedInstruments) {
            if (ins == type) {
                this.instrument = instrument;
                // Nifty: we extend our link manager with the methods of our instrument.
                // (since all instruments support the same API, a change of instrument
                // overrides the methods)
                var instrumentObject =new this.supportedInstruments[ins].type;
                _.extend(this,instrumentObject);
                this.trigger('instrumentChanged'); // Tell views who rely on the instrument manager...
                }
            }
        }

        this.getInstrument = function() {
            return this.instrument;
        }
        
    };

    _.extend(InstrumentManager.prototype, Backbone.Events);
    
    return InstrumentManager;

});