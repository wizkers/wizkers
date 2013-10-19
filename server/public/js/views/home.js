// The main screen of our app.
// 
// Our model is the settings object.

window.HomeView = Backbone.View.extend({

    initialize:function (options) {
        linkManager.on('status', this.updatestatus, this); 
        linkManager.on('uniqueID', this.updateUID, this);
        instrumentManager.on('instrumentChanged', this.updateInstrument, this);
        
        // Keep a reference to our instrument views to close
        // them properly when we close
        this.instrumentLiveView = null;
        this.instrumentNumericView = null;
        
        // We manage the instrument UniqueID and storage of its
        // properties in the home view (this is common across all
        // instrument types in the application)
        this.instrumentUniqueID = null;
        
        this.instrument = instrumentManager.getInstrument();
        this.recording = false;
        
    },
    
    events: {
        "click .ctrl-connect":  "ctrlConnect",
        "click .ctrl-diag": "ctrlDiag",
        "click .ctrl-record": "ctrlRecord",
        "click .start-record": "startRecord",
        "click a": "handleaclicks",
    },
    
    /* Nice way to disable an anchor button when it is disabled */
    handleaclicks: function(event) {
        if ($(event.currentTarget).attr('disabled'))
            event.preventDefault();
    },
    
    updateInstrument: function() {
        // Whenever the instrument is updated in the manager, we need to
        // re-render. In particular,the manager is usually updated after 1st rendering
        // of the home view after selecting an instrument.
        this.instrument = instrumentManager.getInstrument();
        this.render();
    },
    
    render:function () {
        var self = this;
        console.log('Main render of Home view');
        $(this.el).html(this.template(this.model.toJSON()));
        
        if (this.instrumentLiveView != null)
            this.instrumentLiveView.onClose();
        
        if (this.instrumentNumericView != null)
            this.instrumentNumericView.onClose();

        
        // If we have a selected instrument, then instanciate its liveview here
        if (settings.get('currentInstrument') != null) {
            console.log('Create the instrument live view');
            self.instrumentLiveView = instrumentManager.getLiveDisplay({model: self.instrument, lm: linkManager});
            if (self.instrumentLiveView != null) {
                $('#liveview').html(self.instrumentLiveView.el);
                self.instrumentLiveView.render();
            }
            
            // Now start the numeric display (the one on the right)
            self.instrumentNumericView = instrumentManager.getNumDisplay({model: settings, lm: linkManager});
            if (self.instrumentNumericView != null) {
                $('#numview').html(self.instrumentNumericView.el);
                self.instrumentNumericView.render();
            }
                
            // Enable the "Connect" button now that we are ready
            $('.ctrl-connect', this.el).removeAttr('disabled');
        }
        
        linkManager.requestStatus();
        
        return this;
    },
        
    onClose: function() {
        console.log("Home view closing...");
        
        linkManager.off('status', this.updatestatus, this);
        linkManager.off('uniqueID', this.updateUID, this);
        instrumentManager.off('instrumentChanged', this.updateInstrument, this);
        
        if (this.instrumentLiveView != null)
            this.instrumentLiveView.onClose();
        
        if (this.instrumentNumericView != null)
            this.instrumentNumericView.onClose();
        
        linkManager.stopLiveStream();

        // Restore the settings since we don't want them to be saved when changed from
        // the home screen
        this.model.fetch();
    },
        
    updateUID: function(uid) {
        console.log('Received a uniqueID for this instrument: ' + uid);
        var savedUID = this.instrument.get('uuid');
        console.log('Our instrument type is ' + this.instrument.get('type'));
        if (savedUID == "") {
            this.instrument.set('uuid',uid);
            this.instrument.save();
        } else
        if (savedUID != uid) {
            alert("Oops, this is a new instrument of the same model, please create another entry in the instruments screen");
        }
        // Now, we are sure our instrument is linked to a UID, so we are able to save logs
        // in our backend database, that are uniquely linked to this instrument.
    },
    
    ctrlDiag: function() {
        app.navigate('diagnostics/' + this.instrument.id, true);
    },

    updatestatus: function(data) {
        // Depending on port status, update our controller
        // connect button:
        if (linkManager.connected) {
            $('.ctrl-connect', this.el).html("<i class=\"icon-off icon-white\"></i>&nbsp;Disconnect " + this.instrument.get('name'))
                .removeClass('btn-danger').addClass('btn-success').removeClass('btn-warning').removeAttr('disabled');
            $('.btn-enable-connected', this.el).removeAttr('disabled');
            
            if (this.instrumentUniqueID == null) {
                linkManager.getUniqueID();
            }
        } else {
            $('.ctrl-connect', this.el).html("<i class=\"icon-off icon-white\"></i>&nbsp;Connect to " + this.instrument.get('name'))
                .addClass('btn-danger').removeClass('btn-success').removeClass('btn-warning').removeAttr('disabled');
            $('.btn-enable-connected', this.el).attr('disabled', true);

        }
        if (data.recording) {
            $('.ctrl-record', this.el).html("<i class=\"icon-white icon-pause\"></i>&nbsp;Recording...").addClass('btn-success')
                   .removeClass('btn-danger').attr('disabled', false);
            this.recording = true;
        }

    },


    ctrlConnect: function(event) {
        var self = this;
        if ($('.ctrl-connect', this.el).attr('disabled'))
            return;
        $('.ctrl-connect', this.el).html("<i class=\"icon-off icon-white\"></i>&nbsp;Connecting...").addClass('btn-warning')
                                   .removeClass('btn-success').removeClass('btn-danger').attr('disabled', true);
        // First, get serial port settings (assume Serial for now)
        var port = settings.get('serialPort');
        console.log('Opening serial on port ' + port);
        if (port != null ) {
                if (!linkManager.connected) {
                    self.instrumentUniqueID = null; // Just in case we change the instrument
                    linkManager.openPort(port);
                } else {
                    linkManager.closePort(port);
                }
        }
    },

    ctrlRecord: function() {
        var self = this;
        if ($('.ctrl-record', this.el).attr('disabled')){
                return;
        }
        if (!this.recording) {
            $('#RecordModal').modal();
        } else {
            $('.ctrl-record', this.el).html('<i class="icon-download"></i>&nbsp;Record session').addClass('btn-danger')
                       .removeClass('btn-success');
            $.get('/stoprecording');
            this.recording = false;
        }        
    },
    
    startRecord: function() {
        var self = this;
        $('#RecordModal').modal('hide');
        
        var currentLogSession = new Log();
        currentLogSession.set('name', $('#recordingname',this.el).val());
        currentLogSession.set('description', $('#description', this.el).val());
        currentLogSession.set('logtype', 'live');
        // No need to set instrument ID, it is updated when creating the
        // log session
        this.instrument.logs.add(currentLogSession);
        currentLogSession.save(null,{
                success: function() {
                        $.get('/startrecording/' + currentLogSession.id); // Tell our backend to start recording.
                  }}
          );

        $('.ctrl-record', this.el).html("<i class=\"icon-white icon-pause\"></i>&nbsp;Recording...").addClass('btn-success')
                   .removeClass('btn-danger').attr('disabled', false);
        this.recording = true;
    },
    
});