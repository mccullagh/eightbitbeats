(function() {
    
    /* Prevents duplicate sound plays, 
     * and caches future sounds 
     * */
    soundManager = (function () {
        var toPlay = {}; // HashSet stand-in
        var cache = {};
        return {
            addFile: function(file) {
                if (!cache.file) {
                    cache[file] = file;
                }
            },
            play: function() {
                if ( !!_.size(toPlay) ) {
                    _.each(toPlay, function(name) {
                        playSound(name);
                    });
                }
                toPlay = $.extend({}, cache);
                cache = {};
            }
        };
    })();

    instrumentsList = [
        {name: 'dr', filenames: ['dj_throb','dj_swish','hh','hh','tom_high']},
        {name: 're', filenames: ['dj_swish','hh','hh','tom_high', 'dj_throb']},
        {name: 's1', filenames: ['hh','hh','tom_high','dj_throb','dj_swish']},
        {name: 's2', filenames: ['hh','tom_high','dj_throb','dj_swish','hh']},
        {name: 's3', filenames: ['tom_high','dj_throb','dj_swish','hh','hh']},
    ];

    Backbone.emulateHTTP = true;
    Backbone.emulateJSON = true;

    // underscore template languate settings
    _.templateSettings = {
      interpolate : /\{\{(.+?)\}\}/g, // {{ var }}
      evaluate: /\{\%(.+?)\%\}/g // {% expression %}
    }; 


    App = Backbone.Model.extend({
        start: function() {
            player = new Player();
            playerView = new PlayerView({model: player, el: $('.player')});
            instruments = new Instruments(instrumentsList);

            // Start the play loop
            // TODO maybe wrap this in a deferred for post sync
            // and post username dialog, etc
            // $.when(cond1, cond2)
            setInterval(function(){ player.play(player); }, 0);
        }
    });

    
    Player = Backbone.Model.extend({
        initialize: function() {
            this.tracks = new Tracks;
            this.tracks.player = this;

            this.megaMen = new MegaMen;
            this.megaMen.player = this;


            this.bind('change:step',  this.playStep );
        },

        defaults: {
            tracks: [],
            bpm: 120,
            step: 0,
            length: 64
        },
       
        syncTracks: function(data) {
            var model = this;
            _.each(data, function(track, id) {
                if (!model.tracks.get(id)) {
                    // Then add this track
                    model.createTrack(id, track.user, track.timestamp, track.instrument, track.steps);
                }
            });
        },

        createTrack: function(trackID, userObj, timestamp, instrument, steps) {
            var track = new Track({ 
                'id': trackID, 
                'timestamp': timestamp,
                'instrument': instruments.get(instrument),
                'user': new User//(userObj)
            });

            track.fillSteps(steps);
            this.tracks.add(track);
        },

        incStep: function(inc) {
            this.set({'step': (this.get('step') + 1) % this.get('length')});
        },

        playStep: function() {
            var step = this.get('step');
            var model = this;
            model.tracks.each(function(track) {
                track.playStep(step);
            });
            soundManager.play()
        },
        
        play: (function() {
            var skipTicks = 60000 / 4,
                nextTick = (new Date).getTime(); // 60000ms per min / 4ticks per beat

            return function(instance) {
                //loops = 0;
                while ((new Date).getTime() > nextTick) {
                    // play the sounds
                    instance.incStep(1);
                    // Loop business
                    nextTick += skipTicks / instance.get('bpm');
                }

                // stuff that we want refreshed a shit load goes here, probably nothing
            };
        })(),
    });

    PlayerView = Backbone.View.extend({
        initialize: function() {
            _.bindAll(this, 'insertTrack', 'playStep', 'insertMegaMan');

            this.model.bind('change:step', this.playStep);
            this.model.tracks.bind('add', this.insertTrack);
            this.model.tracks.add(this.model.get('tracks'));
            this.model.megaMen.bind('add', this.insertMegaMan);

            var state = 1
            var left = 0;
            for (var i = 0; i < 64; i++) {
                state = state ? 0 : 1;
                this.model.megaMen.add({className: 'run'+state, left: left});
                left += 15;
            }
        },
        
        className: 'player',

        template: _.template($('.player-template').html()),

        events: {
            'click .create-track': 'requestTrack'
        },
        
        playStep: function(model, stepIndex) {
            if (this.lastStep) { 
                this.lastStep.trigger('deactivate'); 
            }
            var step = this.model.megaMen.at(stepIndex);
            this.lastStep = step;
            step.trigger('activate');
        },

        render: function() {
            $(this.el).html(this.template(this.model.toJSON()));
            return this;
        },
        
        requestTrack: function(e) {
            e.preventDefault();
            var user = new User(); //TODO: sign in/global singleton
            socket.emit('claim', {'instrument': instruments.at(0).toJSON(), 'user': user.toJSON()})
        },

        insertTrack: function(track) {
            var trackView = new TrackView({model: track, id: track.id});
            $(this.el).find('.tracks').append(trackView.render().el);
        },

        insertMegaMan: function(megaMan) {
            var megaManView = new MegaManView({model: megaMan, className: megaMan.get('className')});
            $(this.el).find('.runner').append($(megaManView.el).css({left: megaMan.get('left')}));
        }
    });
    

    Instrument = Backbone.Model.extend({
        initialize: function() {

        },

        defaults: {
            name: 'dr',
            filenames: ['dj_throb','dj_swish','hh','hh','tom_high']
        }
    });

    Instruments = Backbone.Collection.extend({
        
    });

    User = Backbone.Model.extend({
        initialize: function() {

        },

        defaults: {
            name: 'Derpminster II',
            avatar: 'http://lorempixum.com/64/64/people/'
        }
    });

    Track = Backbone.Model.extend({
        initialize: function() {
            this.steps = new Steps;
            this.steps.track = this;
            this.bind('change:steps', this.parseSteps);
            this.bind('change:instrument', this.sendInstrumentChange);
        },

        defaults: {
            instrument: new Instrument,
            timestamp: 0,
            user: null,
            steps: []
        },

        parseSteps: function(model, steps) {
            this.steps.reset(steps);
        },

        fillSteps: function(stepsList) {
            var i, n;
            var steps = []
            for (i = 0; i < player.get('length'); i++) {
                var notes = [];
                for (n = 0; n < this.get('instrument').get('filenames').length; n++) {
                    notes.push(!!stepsList ? stepsList[i].notes[n] : 0);
                }
                var step = new Step({notes: notes})
                steps.push(step);
            }
            this.set({steps: steps}, {silent: true});
        },

        sendInstrumentChange: function() {
            socket.emit('instrument', {trackID: this.id, instrument: this.get('instrument').toJSON()});
        },
        
        playStep: function(stepIndex) {
            var model = this;
            if (this.lastStep) { 
                this.lastStep.trigger('deactivate'); 
            }
            var step = model.steps.at(stepIndex);
            this.lastStep = step;
            var nextStep = model.steps.at((stepIndex+1)%64);
            step.trigger('activate');
            $.each(nextStep.get('notes'), function(i, note) {
                if (!!note) {
                    soundManager.addFile(model.get('instrument').get('filenames')[i]);
                }
            });
        }
    });

    TrackView = Backbone.View.extend({
        initialize: function() {
            _.bindAll(this, 'insertStep', 'removeView', 'changeInstrument');
            this.model.steps.bind('add', this.insertStep);
            this.model.bind('change:instrument', this.changeInstrument);
            this.model.bind('remove', this.removeView);            
            this.model.steps.add(this.model.get('steps'), {silent: true});
        },
        
        className: 'track',

        template: _.template($('.track-template').html()),

        events: {
            'click .avatar': 'deleteTrack',
            'click .inst': 'selectInstrument'
        },

        selectInstrument: function(e) {
            $button = $(e.target).hasClass('inst') ? $(e.target) : $(e.target).closest('.inst');
            var instrumentCid = $button.attr('data-cid');
            $button.siblings().removeClass('active');
            $button.addClass('active');
            this.model.set({'instrument': instruments.getByCid(instrumentCid)});
        },

        deleteTrack: function() {
            socket.emit('release', { 'trackID': this.model.id });
            this.model.collection.remove(this.model);
        },
        
        removeView: function() {
            this.remove();
        },

        changeInstrument: function(track, instrument) {
            $el = $(this.el);
            $el.find('.inst').removeClass('active');
            $el.find('[data-name='+instrument.get('name')+']').addClass('active');
        },
        
        render: function() {
            var view = this;
            $(view.el).html(this.template(this.model.toJSON()));

            this.model.steps.each(function(step) {
                view.insertStep(step);
            });
            return this;
        },

        insertStep: function(step) {
            var stepView = new StepView({model: step, id: step.id});
            $(this.el).find('.steps').append(stepView.render().el);
        }
    });

    Tracks = Backbone.Collection.extend({
        initialize: function() {
    
        },

        comparator: function(track) {
            return track.get('timestamp');
        }
        
    });

    
    Step = Backbone.Model.extend({
        initialize: function() {
            this.bind('change:notes', this.sendNoteChange);
        },

        sendNoteChange: function(step, notes) {
            socket.emit('change', {track: step.collection.track.id, step: step.collection.indexOf(step), notes: notes})
        }
        
    });

    StepView = Backbone.View.extend({
        initialize: function() {
            _.bindAll(this, 'render', 'activate', 'deactivate');
            this.model.bind('change', this.render);
            this.model.bind('activate', this.activate);
            this.model.bind('deactivate', this.deactivate);
        },

        events: {
            'click .note': 'toggleNote'
        },

        toggleNote: function(e) {
            var $note = $(e.target);
            var notes = this.model.get('notes').slice(0);
            var i = $note.data('index');
            var newValue = $note.hasClass('on') ? 0 : 1;
            notes[i] = newValue;
            this.model.set({ 'notes': notes });
            if (!!newValue) {
                playSound(this.model.collection.track.get('instrument').get('filenames')[i]);
            }
        },

        className: 'step',
        
        template: _.template($('.step-template').html()),
        
        render: function() {
            $(this.el).html(this.template(this.model.toJSON())).attr('data-index', this.model.collection.indexOf(this.model));
            return this;
        },

        activate: function() {
            $(this.el).addClass('active');
        },

        deactivate: function() {
            $(this.el).removeClass('active');
        }
    });

    Steps = Backbone.Collection.extend({
        model: Step
    });

    MegaMan = Backbone.Model.extend({
        
    });

    MegaManView = Backbone.View.extend({
        initialize: function() {
            _.bindAll(this, 'activate', 'deactivate');
            this.model.bind('activate', this.activate);
            this.model.bind('deactivate', this.deactivate);
        },

        activate: function() {
            $(this.el).addClass('on');
        },

        deactivate: function() {
            $(this.el).removeClass('on');
        }
    });

    MegaMen = Backbone.Collection.extend({
        
    });

    app = new App()
    app.start();
})()
