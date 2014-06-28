/*
 * The main screen of our app.
 * 
 * Our model is the settings object.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */


define(function(require) {
    
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        Devicelog = require('app/models/devicelog'),
        tpl     = require('text!tpl/HomeView.html'),
        template = null;
        
        try {
            template = _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            template = require('js/tpl/HomeView.js');
        }
            
    // We have to require bootstrap whenever we use the Bootstrap javascript
    // library. In this file, we use it for 'modal' calls.
    require('bootstrap');

    return Backbone.View.extend({

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
            $(this.el).html(template(this.model.toJSON()));
            
            if (vizapp.type == 'server') {
                // If we're running with a backend server, we need to hide some elements
                // in case we are only a 'viewer'. This is not relevant if we're running as an app,
                // since we're always an admin there
                if (settings.get('currentUserRole') == 'viewer') {
                    $('#control-area', this.el).hide();
                }
            }

            if (this.instrumentLiveView != null)
                this.instrumentLiveView.onClose();

            if (this.instrumentNumericView != null)
                this.instrumentNumericView.onClose();

            // If we have a selected instrument, then instanciate its liveview here
            if (settings.get('currentInstrument') != null) {
                console.log('Create the instrument live view');

                instrumentManager.getLiveDisplay({model: this.instrument}, function(view) {
                    self.instrumentLiveView = view;
                    if (view != null) {
                        $('#liveview').html(view.el);
                        view.render();
                    }
                });

                // Now start the numeric display (the one on the right)
                instrumentManager.getNumDisplay({model: this.instrument}, function(view) {
                    self.instrumentNumericView = view;
                    if (view != null) {
                        $('#numview').html(view.el);
                        view.render();
                    }
                });

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

            // Restore the settings since we don't want them to be saved when changed from
            // the home screen
            this.model.fetch();
        },

        updateUID: function(uid) {
            console.log('Received a uniqueID for this instrument: ' + uid);
            this.instrumentUniqueID = uid;
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
            router.navigate('diagnostics/' + this.instrument.id, true);
        },

        updatestatus: function(data) {
            // First of all, if we don't have an instrument, no need to update our status:
            if (this.instrument == null)
                return;
            // Depending on port status, update our controller
            // connect button:
            if (linkManager.isConnected()) {
                $('.ctrl-connect', this.el).html('<span class="glyphicon glyphicon-off"></span>&nbsp;Disconnect ' + this.instrument.get('name'))
                    .removeClass('btn-danger').addClass('btn-success').removeClass('btn-warning').removeAttr('disabled');
                $('.btn-enable-connected', this.el).removeAttr('disabled');

                if (this.instrumentUniqueID == null) {
                    linkManager.getUniqueID();
                }
                // Depending on device capabilities, enable/disable "Diag view" button
                if (instrumentManager.getCaps().indexOf("DiagDisplay") == -1 || ! linkManager.isConnected()) {
                        $('.ctrl-diag',self.el).attr('disabled', true);
                }            
            } else {
                $('.ctrl-connect', this.el).html('<span class="glyphicon glyphicon-off"></span>&nbsp;Connect to ' + this.instrument.get('name'))
                    .addClass('btn-danger').removeClass('btn-success').removeClass('btn-warning').removeAttr('disabled');
                $('.btn-enable-connected', this.el).attr('disabled', true);

            }
            if (data.recording) {
                $('.ctrl-record', this.el).html('<span class="glyphicon glyphicon-pause"></span>&nbsp;Recording...').addClass('btn-success')
                       .removeClass('btn-danger').attr('disabled', false);
            } else {
                $('.ctrl-record', this.el).html('<span class="glyphicon glyphicon-download"></span>&nbsp;Record session').addClass('btn-danger')
                           .removeClass('btn-success');
            }

        },


        ctrlConnect: function(event) {
            var self = this;
            if ($('.ctrl-connect', this.el).attr('disabled'))
                return;
            $('.ctrl-connect', this.el).addClass('btn-warning')
                                       .removeClass('btn-success').removeClass('btn-danger').attr('disabled', true);
            // First, get serial port settings (assume Serial for now)
            var id = instrumentManager.getInstrument().id;
            if (id != null ) {
                    if (!linkManager.isConnected()) {
                        $('.ctrl-connect', this.el).html('<span class="glyphicon glyphicon-off"></span>&nbsp;Opening...')
                        self.instrumentUniqueID = null; // Just in case we change the instrument
                        linkManager.openInstrument(id);
                    } else {
                        $('.ctrl-connect', this.el).html('<span class="glyphicon glyphicon-off"></span>&nbsp;Closing...')
                        linkManager.closeInstrument(id);
                    }
            }
        },

        ctrlRecord: function() {
            var self = this;
            if ($('.ctrl-record', this.el).attr('disabled')){
                    return;
            }
            if (!linkManager.isRecording()) {
                $('#RecordModal').modal();
            } else {
                linkManager.stopRecording();
            }        
        },

        startRecord: function() {
            var self = this;
            $('#RecordModal').modal('hide');

            var currentLogSession = new Devicelog.Log();
            currentLogSession.set('name', $('#recordingname',this.el).val());
            currentLogSession.set('description', $('#description', this.el).val());
            currentLogSession.set('logtype', 'live');
            // No need to set instrument ID, it is updated when creating the
            // log session
            this.instrument.logs.add(currentLogSession);
            currentLogSession.save(null,{
                    success: function() {
                        linkManager.startRecording(currentLogSession.id); // Tell our backend to start recording.
                      }}
              );

            $('.ctrl-record', this.el).html('<span class="glyphicon glyphicon-pause"></span>&nbsp;Recording...').addClass('btn-success')
                       .removeClass('btn-danger').attr('disabled', false);
        },

    });
});