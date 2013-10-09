// The main screen of our app.
// 
// Our model is the settings object.

window.HomeView = Backbone.View.extend({

    initialize:function (options) {
        this.manager = this.options.im;
        this.settings = this.model;
        this.linkManager = this.options.lm;
        this.linkManager.on('status', this.updatestatus, this);  
        
        // Keep a reference to our instrument views to close
        // them properly when we close
        this.instrumentLiveView = null;
        this.instrumentNumericView = null;
        
    },
    
    events: {
        "click .ctrl-connect":  "ctrlConnect",

    },
    
    render:function () {
        var self = this;
        console.log('Main render of Home view');
        $(this.el).html(this.template(this.model.toJSON()));
        
        // If we have a selected instrument, then instanciate its liveview here
        if (this.settings.get('currentInstrument') != null) {
            console.log('Create the instrument live view');
            var ins = new Instrument({_id: this.settings.get('currentInstrument')});
            ins.fetch({success: function(){
                // We have the instrument, get the correct view for it:
                var type = ins.get('type');
                console.log('Ins type: ' + type );
                self.instrumentLiveView = self.manager.getInstrumentType(type).getLiveDisplay({model: self.settings, lm: self.linkManager});
                $('#liveview').html(self.instrumentLiveView.el);
                self.instrumentLiveView.render();
                
                // Now start the numeric display (the one on the right)
                self.instrumentNumericView = self.manager.getInstrumentType(type).getNumDisplay({model: self.settings, lm: self.linkManager});
                if (self.instrumentNumericView != null) {
                    $('#numview').html(self.instrumentNumericView.el);
                    self.instrumentNumericView.render();
                }

            }});
        }
        
        this.linkManager.requestStatus();
        
        return this;
    },
        
    onClose: function() {
        console.log("Home view closing...");
        
        this.linkManager.off('status', this.updatestatus, this);
        this.linkManager.off('input', this.showInput, this);
        
        if (typeof(this.instrumentLiveView) != undefined)
            this.instrumentLiveView.onClose();
        
        if (typeof(this.instrumentNumericView) != undefined)
            this.instrumentNumericView.onClose();

        // Restore the settings since we don't want them to be saved when changed from
        // the home screen
        this.model.fetch();
    },

    updatestatus: function(data) {
        // Depending on port status, update our controller
        // connect button:
        if (this.linkManager.connected) {
            $('.ctrl-connect', this.el).html("<i class=\"icon-off icon-white\"></i>&nbsp;Disconnect instrument")
                .removeClass('btn-danger').addClass('btn-success').removeClass('btn-warning').removeAttr('disabled');
            $('.btn-enable-connected', this.el).removeAttr('disabled');
        } else {
            $('.ctrl-connect', this.el).html("<i class=\"icon-off icon-white\"></i>&nbsp;Connect to instrument")
                .addClass('btn-danger').removeClass('btn-success').removeClass('btn-warning').removeAttr('disabled');
            $('.btn-enable-connected', this.el).attr('disabled', true);

        }
    },


    ctrlConnect: function() {
        var self = this;
        if ($('.ctrl-connect', this.el).attr('disabled'))
            return;
        $('.ctrl-connect', this.el).html("<i class=\"icon-off icon-white\"></i>&nbsp;Connecting...").addClass('btn-warning').removeClass('btn-success')
                                   .removeClass('btn-danger').attr('disabled', true);
        // First, get serial port settings (assume Serial for now)
        var port = this.model.get('serialPort');
        console.log('Opening serial on port ' + port);
        if (port != null ) {
                if (!self.linkManager.connected) {
                    self.linkManager.openPort(port);
                } else {
                    self.linkManager.closePort(port);
                }
        }
    },
        
});