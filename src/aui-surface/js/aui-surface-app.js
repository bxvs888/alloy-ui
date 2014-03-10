var Lang = A.Lang;

A.SurfaceApp = A.Base.create('surface-app', A.Router, [A.PjaxBase], {
    /**
     * Holds the active path.
     *
     * @property activeChild
     * @type {String}
     * @protected
     */
    activePath: null,

    /**
     * Holds the active screen.
     *
     * @property activeScreen
     * @type {Screen}
     * @protected
     */
    activeScreen: null,

    /**
     * Maps the screen classes by the path.
     *
     * @property screens
     * @type {Object}
     * @protected
     */
    screenFactories: null,

    /**
     * Maps the screen instances by the screen id.
     *
     * @property screens
     * @type {Object}
     * @protected
     */
    screens: null,

    /**
     * Map that index the surfaces instances by the screen id.
     *
     * @property surfaces
     * @type {Object}
     * @protected
     */
    surfaces: null,

    /**
     * Construction logic executed during SurfaceApp instantiation.
     * Lifecycle.
     *
     * @method initializer
     * @protected
     */
    initializer: function() {
        this.screens = {};
        this.on('navigate', this._onNavigate);
        this._registerRoutes(this.get('screens'));
    },

    /**
     * Finalizes a screen navigation.
     *
     * @method  _finalizeNavigate
     * @param {String} path
     * @param {Screen} screen
     * @private
     */
    _finalizeNavigate: function(path, screen) {
        var activeScreen = this.activeScreen;

        screen.afterFlip();

        if (activeScreen && !activeScreen.get('cacheable')) {
            this._removeScreen(this.activePath, activeScreen);
        }
        this.activePath = path;
        this.activeScreen = screen;
        this.screens[path] = screen;
    },

    /**
     * TODO:
     *   -
     *   - If screen is cacheable read its value from cache and leave the screen surface children in doc.
     *   - Else, invoke screen beforeDeactivate, deactivate and destroy. This should remove all screen surface children.
     * @param  {[type]}   path       [description]
     * @param  {[type]}   ScreenCtor [description]
     * @param  {[type]}   req        [description]
     * @param  {[type]}   res        [description]
     * @param  {Function} next       [description]
     * @return {[type]}              [description]
     */
    _handleNavigate: function(path, ScreenCtor, req, res, next) {
        var instance = this,
            screen = instance.screens[path],
            screenId,
            deffered,
            contents = [],
            surfaces = [],
            transitions = [];

        if (path === this.activePath) {
            A.log('Not navigating, already at destination', 'info');
            return;
        }

        A.log('Navigation starts', 'info');

        if (!screen) {
            A.log('Screen not found, create one', 'info');
            screen = new ScreenCtor();
        }

        screenId = screen.get('id');

        // Stack the surfaces and its operations in the right order. Since
        // getContentForSurface could return a promise in order to fetch async
        // content pass it to Y.batch in order to resolve them in parallel
        A.log('Loading surfaces content...', 'info');
        A.Object.each(instance.surfaces, function(surface, surfaceId) {
            surfaces.push(surface);
            contents.push(screen.handleSurfaceContent(surfaceId));
        });
        deffered = A.batch.apply(A, contents);
        deffered
            .then(function(data) {
                // When surfaces contents are ready, add them to each surface
                A.Array.each(surfaces, function(surface, i) {
                    surface.addContent(screenId, data[i]);
                    screen.addCache(surface, data[i]);
                });
            })
            .then(function() {
                A.log('Tell the screen to get ready (beforeFlip)...', 'info');
                return A.when(screen.beforeFlip());
            })
            .then(function() {
                if (instance.activeScreen) {
                    A.log('Deactivate the active screen', 'info');
                    instance.activeScreen.deactivate();
                }
            })
            .then(function() {
                instance._setDocumentTitle(screen);
            })
            .then(function() {
                A.log('The screen is ready, batch transitions...', 'info');
                A.Array.each(surfaces, function(surface) {
                    transitions.push(surface.show(screenId));
                });
                // Animations should start at the same time, therefore
                // it's passed to Y.batch to be processed in parallel
                return A.batch.apply(A, transitions);
            })
            .then(function() {
                instance._finalizeNavigate(path, screen);
                A.log('Navigation done, process next screen', 'info');
                next();
            });
    },

    /**
     * Intercepts navigate event in order to prevent url change if needed.
     *
     * @method  _onNavigate
     * @param {EventFacade} event Navigate event facade
     * @private
     */
    _onNavigate: function(event) {
        if (this.activeScreen && this.activeScreen.beforeDeactivate()) {
            A.log('Navigation cancelled by active screen', 'info');
            event.halt();
        }
    },

    /**
     * Removes a screen.
     *
     * @method  _removeScreen
     * @param {String} path
     * @param {Screen} screen
     * @private
     */
    _removeScreen: function(path, screen) {
        var instance = this,
            screenId = screen.get('id');

        A.Object.each(instance.surfaces, function(surface) {
            surface.remove(screenId);
        });
        screen.destroy();
        delete instance.screens[path];
    },

    /**
     * Registers a route for a screen.
     *
     * @method  _registerRoutes
     * @param {Array} screenFactories Array of objects with `path` and `screen`
     *     keys.
     * @private
     */
    _registerRoutes: function(screenFactories) {
        var instance = this;

        A.Object.each(screenFactories, function(screenFactory) {
            instance.route(
                screenFactory.path,
                A.bind(instance._handleNavigate, instance, screenFactory.path, screenFactory.screen));
        });
    },

    /**
     * Updates the document title with the `title` of the screen or the
     * `defaultTitle` of the surface app.
     *
     * @method  _setDocumentTitle
     * @param {Screen} screen
     * @private
     */
    _setDocumentTitle: function(screen) {
        A.config.doc.title = screen.get('title') || this.get('defaultTitle');
    },

    /**
     * Sets screens attribute.
     *
     * @method  _setScreens
     * @private
     * @param {Array} val Array of objects, each object should contain `path`
     *     and `screen`.
     * @return {Array}
     */
    _setScreens: function(val) {
        var instance = this;

        instance.screenFactories = {};
        A.Array.each(val, function(data) {
            instance.screenFactories[String(data.path)] = data.screen;
        });
        return val;
    },

    /**
     * Sets surfaces attribute.
     *
     * @method  _setSurfaces
     * @private
     * @param {[Surface | String]} val Array of Surface instances or ids of the
     *     surface DOM element.
     * @return {Array} Array of Surface instances.
     */
    _setSurfaces: function(val) {
        var instance = this;

        instance.surfaces = {};
        A.Array.each(val, function(surface, i) {
            if (Lang.isString(surface)) {
                surface = new A.Surface({
                    id: surface
                });
            }
            val[i] = surface;
            instance.surfaces[surface] = surface;
        });
        return val;
    }

}, {
    ATTRS: {
        /**
         * Defines the default document title in case the screen doesn't have
         * any `title`.
         *
         * @attribute defaultTitle
         * @default Home
         * @type {String}
         */
        defaultTitle: {
            validator: Lang.isString,
            value: 'Home'
        },

        /**
         * Maps the `path` and `screen` values. The `path` should be a string or
         * a regex that maps the navigation route to a screen class definition
         * (not an instance), e.g:
         *
         *     `{ path: "/home:param1", screen: Y.MyScreen }`
         *     `{ path: /foo.+/, screen: Y.MyScreen }`
         *
         * @attribute screens
         * @default []
         * @type {Array}
         */
        screens: {
            setter: '_setScreens',
            validator: Lang.isArray,
            value: [],
            writeOnce: true
        },

        surfaces: {
            lazyAdd: false,
            setter: '_setSurfaces',
            validator: Lang.isArray,
            value: [],
            writeOnce: true
        }
    }
});