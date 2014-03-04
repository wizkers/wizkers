window.ElecraftFrequencyListView = Backbone.View.extend({

    tagName: "div",
    className: "carousel-inner",
    
    initialize: function (options) {
        this.options = options || {};
        
        this.bands= [ "160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m" ];
        
        // The server lets us specify free-form metadata for each instrument,
        // we are using it for storing our frequencies, per band:
        // { frequencies: {
        //     "20m": [
        //          { vfoa: 14.070, vfob: 14.100, mode: "psk31", name: "This is a comment" },
        //            ...
        //      ],
        //   }
        //}
        //
        // TODO Also: we can setup in the KX3 settings how many frequencies per panel we want
        // will be stored in "cardsperpanel" attribute.
        // 
        var metadata = this.model.get('metadata');
        this.frequencies = metadata.frequencies;
        if (this.frequencies == null) {
            this.frequencies = {
                                "6m": [], 
                                "10m": [
                                        { "vfoa": 28.120, "vfob": 28.120, "mode": "DATA A", "name": "PSK31" },
                                ],
                                "12m": [],
                                "15m": [],
                                "17m": [],
                                "20m": [ { "vfoa": 14.070, "vfob": 14.100, "mode": "DATA A", "name": "PSK31" },
                                         { "vfoa": 14.085, "vfob": 14.100, "mode": "DATA A", "name": "RTTY" },
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
        
        // TODO: get input and follow frequencies to track current band and re-render.
        linkManager.on('input', this.showInput, this);

        
    },

    render: function () {
        var len = this.frequencies[this.current_band].length;        
        console.log("Frequency list: " + len + " frequencies");

        $(this.el).html('<div class="item active"></div>');
        
        for (var screen = 0; screen < len/4; screen++) {
            console.log("rendering screen " + screen);
            if (screen) $(this.el).append('<div class="item other-'+screen+'"></div>');
            for (var i = screen*4; i < Math.min(len,screen*4+4); i++) {
                $(screen ? '.other-'+screen : '.active', this.el).append(new ElecraftFrequencyItemView({model: this.model, band: this.current_band, 
                                                                                                        frequency: i}).render().el);
            }
        }

        return this;
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
            this.current_band = this.bands[parseInt(val)];
            console.log(this.current_band);
            this.render();
        }

        
    },
    
});

window.ElecraftFrequencyItemView = Backbone.View.extend({

    tagName: "div",
    className: "col-md-3",
    
    editing: false,
    frequency: 0,

    initialize: function (options) {
        console.log("Frequency item - rending item " + options.frequency);
        this.frequency = options.frequency; // What entry in the band memory
        this.band = options.band;           // The current band memory
        this.mem = this.model.get('metadata').frequencies[this.band][this.frequency]; // should always be defined
    },

    render: function () {
        // Extract the correct frequency memory from our model
        // (I kept using the model so that the frequency item can save it
        // upon edit, but it might not be optimal, I am a crap coder)
        
        
        $(this.el).html(this.template(this.mem));
        $(".freq-description",this.el).editable();
        $(".freq-vfoa",this.el).editable();

        return this;
    },
    
    events: {
        "click .panel" : "selectFrequency",
        "click .edit": "editFrequency",
        "change": "changeEvent",
    },
    
    changeEvent: function(event) {
        // Every time one of our editable fields changes, we end up here
        console.log(event);
        // Update the model:
        var vfoa = parseFloat($(".freq-vfoa",event.currentTarget).html());
        var vfob = parseFloat($(".freq-vfob",event.currentTarget).html());
    },
    
    editFrequency: function(event) {
        $(".freq-description",this.el).editable('toggleDisabled');
        $(".freq-vfoa",this.el).editable('toggleDisabled');
        this.editing = ! this.editing;
        return false; // stop propagation
    },

    selectFrequency: function(event) {
        if (this.editing)
            return true;
        console.log('Frequency selected: ' + event);
        var vfoa = parseFloat($(".freq-vfoa",event.currentTarget).html());
        linkManager.driver.setVFO(vfoa,"a");
        return true;
    },
    

});