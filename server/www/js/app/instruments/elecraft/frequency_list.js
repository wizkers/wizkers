/**
 * Render a carousel of frequency memories, handle editing and updating.
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        Snap    = require('snap'),
        bootbox  = require('bootbox'),
        tpl     = require('text!tpl/instruments/ElecraftFrequencyItemView.html'),
        template = null;
        
        try {
            template = _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            template = require('js/tpl/instruments/ElecraftFrequencyItemView.js');
        }
    
    // Need to load these, but no related variables.
    require('bootstrap');
    require('bootstrapeditable');

    
        /**
     * Model is the instrument. This is a single frequency card: vfoa, vfob, description & mode.
     */
    var ElecraftFrequencyItemView = Backbone.View.extend({

        tagName: "div",
        className: "col-md-3 col-sm-6 col-xs-6",

        editing: false,
        frequency: 0,
        band: "",
        allmems: null,
        mem: null,
        listView: null,

        initialize: function (options) {
            // console.log("Frequency item - rendering item " + options.frequency);
            this.listView = options.listView;
            this.frequency = options.frequency; // What entry in the band memory
            this.band = options.band;           // The current band memory (string)
            this.allmems = this.model.get('metadata').frequencies;
            if (this.allmems[this.band] === undefined) {
                // This will happen whenever we have a new band that was not present in previous software versions
                this.allmems[this.band] = [];
            }
            this.mem = this.allmems[this.band][this.frequency]; // should always be defined

            _.bindAll(this,'checkFreqBoundaries');
            _.bindAll(this,'changeEvent');
        },

        render: function () {
            var self = this;
            // Extract the correct frequency memory from our model        
            $(this.el).html(template(this.mem));

            // Now make the fields editable in-line, along with the right
            // validation options - don't get out of the bands in particular -
            // Also, update the memory values
            $(".freq-description",this.el).editable({ success: function(response,newValue) {
                                                                self.mem.name = newValue;
                                                                self.changeEvent();
                                                                }
                                                    });
            $(".freq-vfoa",this.el).editable({validate: this.checkFreqBoundaries,
                                               success: function(response,newValue) {
                                                                self.mem.vfoa = newValue;
                                                                self.changeEvent();
                                                                }
                                             });
            $(".freq-vfob",this.el).editable({ validate: this.checkFreqBoundaries,
                                                success: function(response,newValue) {
                                                                self.mem.vfob = newValue;
                                                                self.changeEvent();
                                                                }
                                             });

            $(".freq-mode", this.el).editable({ success: function(response, newValue) {
                                                    self.mem.mode = newValue;
                                                    self.changeEvent();
                                                    },
                                                source: [{value:"LSB",text:"LSB"},
                                                        {value:"USB", text:"USB"},
                                                         {value:"CW", text:"CW"},
                                                        {value:"DATA", text:"DATA"},
                                                        {value:"AM", text:"AM"},
                                                        {value:"FM", text:"FM"}],
                                              });

            return this;
        },

        events: {
            "click .trash": "removeFrequency",
            "click .panel" : "selectFrequency",
            "click .edit": "editFrequency",
        },

        // End frequencies of each band. 4500 kHz is the 80 meter/60 meter transition for KX3. The K3 uses 4800 kHz.
        /* 0        <= BAND160  < 3000 kHz */
        /* 3000     <= BAND80   < 4500 */
        /* 4500     <= BAND60   < 6000 */
        /* 6000     <= BAND40   < 8500 */
        /* 8500     <= BAND30   < 13000 */
        /* 13000    <= BAND20   < 17000 */
        /* 17000    <= BAND17   < 19000 */
        /* 19000    <= BAND15   < 23000 */
        /* 23000    <= BAND12   < 26000 */
        /* 26000    <= BAND10   < 38000 */
        /* 38000    <= BAND6    < 54000 */
        boundaries: {
            "160m": {min: 0, max: 3000},
            "80m": {min: 3000, max: 4500 },
            "60m": {min: 4500, max:6000 },
            "40m": {min:6000, max:8500 },
            "30m": {min:8500, max:13000},
            "20m": {min:13000, max:17000},
            "17m": {min:17000, max:19000},
            "15m": {min: 19000, max:23000},
            "12m": {min:23000, max:26000},
            "10m": {min:26000, max:38000},
            "6m":  {min:38000, max:54000},
            "2m":  {min:120000, max: 200000 }
        },


        checkFreqBoundaries: function(value) {

            console.log("Validate frequency: "+ value);
            var val = parseFloat(value);
            if (isNaN(val))
                return "Please enter a number";
            // We gotta do validation of the band boundaries
            if ( (val*1000 <= this.boundaries[this.band].min) ||
                (val*1000 > this.boundaries[this.band].max) )
                return "Value outside of current band";
        },

        changeEvent: function() {
            // Update the metadata and save:
            this.allmems[this.band][this.frequency] = this.mem;
            this.model.set('metadata', {"frequencies": this.allmems} );
            this.model.save();
            this.listView.refresh();
        },

        editFrequency: function(event) {
            $("#xtrafunc-leftside").css('overflow', (this.editing) ? "hidden":"visible");
            $(".freq-description",this.el).editable('toggleDisabled');
            $(".freq-vfoa",this.el).editable('toggleDisabled');
            $(".freq-vfob",this.el).editable('toggleDisabled');
            $(".freq-mode", this.el).editable('toggleDisabled');
            this.editing = ! this.editing;
            return false; // stop propagation
        },

        selectFrequency: function(event) {
            if (this.editing)
                return true;
            console.log('Frequency selected: ' + event);
            var vfoa = parseFloat($(".freq-vfoa",event.currentTarget).html());
            var vfob = parseFloat($(".freq-vfob",event.currentTarget).html());
            linkManager.driver.setVFO(vfoa,"a");
            linkManager.driver.setVFO(vfob,"b");
            var mode = $('.freq-mode',event.currentTarget).html();
            var modecode = this.listView.modes.indexOf(mode);
            if (modecode == -1) modecode = 4;
            linkManager.driver.setMode(modecode+1);
            return true;
        },

        removeFrequency: function(event) {
            var self = this;
            // Use Bootbox for a quick OK/Cancel confirmation
            bootbox.confirm("Are you sure you want to delete this card?<br>" + this.mem.vfoa + " MHz", function(result) {
                if (result) {
                    self.listView.removefrequency(self.frequency);                
                }
            });
            return false; // stop propagation
        }


    });
    
    
    return Backbone.View.extend({

        tagName: "div",
        className: "carousel-inner",
    
        initialize: function (options) {
            this.options = options || {};

            this.bands= [ "160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", 0,0,0,0,0, "2m"  ];

            // The server lets us specify free-form metadata for each instrument,
            // we are using it for storing our frequencies, per band.
            // 
            var metadata = this.model.get('metadata');
            this.frequencies = metadata.frequencies;
            if (this.frequencies == null) {
                this.frequencies = {
                                    "2m": [],
                                    "6m": [], 
                                    "10m": [
                                            { "vfoa": 28.120, "vfob": 28.120, "mode": "DATA", "name": "PSK31" },
                                    ],
                                    "12m": [],
                                    "15m": [],
                                    "17m": [],
                                    "20m": [ { "vfoa": 14.070, "vfob": 14.100, "mode": "DATA", "name": "PSK31" },
                                             { "vfoa": 14.085, "vfob": 14.100, "mode": "DATA", "name": "RTTY" },
                                           ],
                                    "30m": [],
                                    "40m": [],
                                    "60m": [],
                                    "80m": [],
                                    "160m": []
                                   };
                this.model.set('metadata', {"frequencies": this.frequencies} );
                this.model.save(null); // TODO: success/failure tracking
            }

            this.current_band = "default";
            this.frequencies.default = [ {"vfoa":0, "vfob": 0, mode:"AM", name:"No Memory defined" } ];
            this.modes = [ "LSB", "USB", "CW", "FM", "AM", "DATA", "CW-REV", 0, "DATA-REV" ];

            this.addingFrequency = false;


            // TODO: get input and follow frequencies to track current band and re-render.
            linkManager.on('input', this.showInput, this);


        },

        render: function () {
            var fr = this.frequencies[this.current_band];
            if (fr === undefined) {
                this.frequencies[this.current_band] = [];
                fr = [];
            }
            var len = fr.length;
            console.log("Frequency list: " + len + " frequencies");

            $(this.el).html('<div class="item active"></div>');

            for (var screen = 0; screen < len/4; screen++) {
                // console.log("rendering screen " + screen);
                if (screen) $(this.el).append('<div class="item other-'+screen+'"></div>');
                for (var i = screen*4; i < Math.min(len,screen*4+4); i++) {
                    $(screen ? '.other-'+screen : '.active', this.el).append(new ElecraftFrequencyItemView({model: this.model, band: this.current_band, 
                                                                                                            frequency: i, listView: this}).render().el);
                }
            }

            return this;
        },
    
        refresh: function() {
            var metadata = this.model.get('metadata');
            this.frequencies = metadata.frequencies;
        },

        onClose: function() {
            console.log("Frequency list closing");
            linkManager.off('input', this.showInput, this);
        },

        showInput: function(data) {
            // Follow band changes to update our frequency cards
            var cmd = data.substr(0,2);
            var val = data.substr(2);

            if (cmd == "BN") {
                var new_band = this.bands[parseInt(val)];
                if (this.current_band == new_band)
                    return; // Avoid useles re-renders;
                this.current_band = new_band;
                console.log(this.current_band);
                this.render();
            } else if (cmd == "MD" && this.addingFrequency) {
                this.addingFrequency = false;
                this.modeCallback(val);
            }
        },

        // Called from our containing view to add a new frequency for this band.
        addfrequency: function() {
            console.log("Add new frequency card");
            // We need to query the radio for its current mode, so we have to go
            // through a callback once this data comes back:
            this.addingFrequency = true;
            linkManager.driver.getMode();
        },

        modeCallback: function(val) {
            var self = this;
            var vfoa = $("#vfoa-direct").val();
            var vfob = $("#vfob-direct").val();
            this.frequencies[this.current_band].push( { "vfoa": vfoa, "vfob": vfob, "mode": this.modes[parseInt(val)-1], "name": "Empty" });
            this.model.set('metadata', {"frequencies": this.frequencies} );
            this.model.save(null, { success: function() { self.render(); } } );
        },

        removefrequency: function(index) {
            var self = this;
            this.frequencies[this.current_band].splice(index,1);
            this.model.set('metadata', {"frequencies": this.frequencies} );
            // Save & ask to re-render the upper level element
            this.model.save(null, { success: function() { self.render(); } } );
        },

    });

  
});