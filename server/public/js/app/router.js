/**
 * The main application router
 *
 * (c) 2014 Edouard Lafargue ed@lafargue.name
 */

define(function(require) {
    
    "use strict";
    
    var $       = require('jquery'),
        Backbone = require('backbone'),
        HeaderView = require('app/views/header');

    return Backbone.Router.extend({

        routes: {
            ""                      : "home",
            "instruments"           : "listInstruments",
            "instruments/page/:page": "listInstruments",
            "instruments/add"       : "addInstrument",
            "instruments/:id"       : "instrumentDetails",
            "workspaces"            : "listWorkspaces",
            "workspaces/page/:page" : "listWorkspaces",
            "workspaces/add"        : "addWorkspace",
            "workspaces/:id"        : "workspaceDetails",
            "logmgt"                : "logmanagement",
            "devicelogs/:id"        : "devicelogmanagement",
            "displaylogs/:ins/:loglist"  : "displaylogs",
            "editlogs/:ins/:loglist": "editlogs",
            "settings"              : "settings",
            "diagnostics/:id"       : "diagnostics",
            "about"                 : "about",
        },
    
        currentView: null,

        switchView: function(view) {
            if (this.currentView) {
                this.currentView.remove();
                if (this.currentView.onClose){
                        this.currentView.onClose();
                }
            }
            $('#content').html(view.el);
            view.render();
            this.currentView = view;
        },

        initialize: function () {
            var self = this;
            console.log("Initializing application");
            this.headerView = new HeaderView();
            $('.header').html(this.headerView.el);


            // When the current instrument model changes, we need to update
            // the link manager type:
            settings.on('change:currentInstrument', function(model, insId) {
                console.log('New instrument ID, updating the link manager type');
                var ins = new Instrument({_id: insId});
                ins.fetch({success: function(){
                    var type = ins.get('type');
                    console.log('New instrument type: ' + type );
                    // Now update our Instrument manager:
                    linkManager.closeInstrument();  // Stop former link manager
                    instrumentManager.setInstrument(ins);
                    linkManager.setDriver(instrumentManager.getLinkManager(linkManager));
                }});
            });


        },

        home: function (id) {
            var self = this;
            console.log("Switching to home view");
            require(['app/views/home'], function(HomeView) {
                var homeView = new HomeView({model:settings});
                self.switchView(homeView);
                self.headerView.selectMenuItem('home-menu');
            });
        },


        diagnostics: function (id) {
            var self = this;
            if (linkManager.connected) {
                console.log('Switching to the instrument diagnostics view');
                self.switchView(instrumentManager.getDiagDisplay({model: settings}));
                self.headerView.selectMenuItem('home-menu');    
            } else {
                app.navigate('/',true);
            }
        },
    
        // Display all logs known for the current instrument
        logmanagement: function() {
            var self = this;
            // Initialize with the list of logs for the current device:
            var logs = instrumentManager.getInstrument().logs;
            logs.fetch({
                success:function() {
                    self.switchView(new LogManagementView({collection: logs}));
                    self.headerView.selectMenuItem('management-menu');
                }});
        },
    
        // Display all selected logs. The list of logs is passed as the
        // view's collection
        displaylogs: function(id,loglist) {
            var self=this;
            // Loglist is a comma-separated list of log IDs
            var logarray = loglist.split(",");
            var allLogs = instrumentManager.getInstrument().logs;
            allLogs.fetch({success:function(){
                var myLogs = allLogs.getLogSubset(logarray);
                self.switchView(instrumentManager.getLogView({collection:myLogs}));
            }});
        },

        // Edit all selected logs. The list of logs is passed as the
        // view's collection
        editlogs: function(id,loglist) {
            var self=this;
            // Loglist is a comma-separated list of log IDs
            var logarray = loglist.split(",");
            var allLogs = instrumentManager.getInstrument().logs;
            allLogs.fetch({success:function(){
                var myLogs = allLogs.getLogSubset(logarray);
                self.switchView(instrumentManager.getLogEditView({collection:myLogs}));
            }});
        },
    
        // Launch log management interface for the device. All existing logs
        // are passed to the view, so that it can easily understand whether a log
        // is already downloaded in the database or not.
        devicelogmanagement: function(id) {
            var self = this;
            if (linkManager.connected) {
                var allLogs = instrumentManager.getInstrument().logs;
                allLogs.fetch({success:function(){
                    self.switchView(instrumentManager.getLogManagementView({collection:allLogs}));
                    self.headerView.selectMenuItem('management-menu');
                }});
            } else {
                app.navigate('/',true);
            }

        },

        // Instrument management
        listInstruments: function(page) {
            var self = this;
            var p = page ? parseInt(page, 10) : 1;
            var instrumentList = new InstrumentCollection();
            instrumentList.fetch({success: function(){
                self.switchView(new InstrumentListView({model: instrumentList, page: p}));
            }});
            this.headerView.selectMenuItem('instrument-menu');

        },

        addInstrument: function() {
            var self = this;
            var instrument = new Instrument();
            this.switchView(new InstrumentDetailsView({model: instrument}));
            this.headerView.selectMenuItem('instrument-menu');

        },

        instrumentDetails: function(id) {
            var self = this;
            var instrument = new Instrument({_id: id});
            instrument.fetch({success: function(){
                self.switchView(new InstrumentDetailsView({model: instrument}));
            }});
            this.headerView.selectMenuItem('instrument-menu');

        },
    
        // Workspace management

        listWorkspaces: function(page) {
            var self = this;
            var p = page ? parseInt(page, 10) : 1;
            var workspaceList = new WorkspaceCollection();
            workspaceList.fetch({success: function(){
                self.switchView(new WorkspaceListView({model: workspaceList, page: p}));
            }});
            this.headerView.selectMenuItem('workspace-menu');

        },

        addWorkspace: function() {
            // TODO: pop up a modal to select an instrument type, and create the instrument
            var workspace = new Workspace();
            this.switchView(new WorkspaceView({model: workspace}));
            this.headerView.selectMenuItem('workspace-menu');

        },


        about: function () {
            var aboutView = new AboutView();
            this.switchView(aboutView);
            this.headerView.selectMenuItem('about-menu');
        },

        settings: function () {
            var settingsView = new SettingsView({model: settings});
            this.switchView(settingsView);
            this.headerView.selectMenuItem('settings-menu');
        },

    });
    
});

