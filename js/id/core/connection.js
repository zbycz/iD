iD.Connection = function() {

    var event = d3.dispatch('authenticating', 'authenticated', 'auth', 'loading', 'load', 'loaded'),
        url = 'http://www.openstreetmap.org',
        connection = {},
        inflight = 0,
        oauth = osmAuth({
            url: 'http://www.openstreetmap.org',
            oauth_consumer_key: '5A043yRSEugj4DJ5TljuapfnrflWDte8jTOcWLlT',
            oauth_secret: 'aB3jKq1TRsCOUrfOIZ6oQMEDmv2ptV76PA54NGLL',
            loading: authenticating,
            done: authenticated
        }),
        ndStr = 'nd',
        tagStr = 'tag',
        memberStr = 'member',
        nodeStr = 'node',
        wayStr = 'way',
        relationStr = 'relation';

    connection.changesetURL = function(changesetId) {
        return url + '/browse/changeset/' + changesetId;
    };

    connection.changesetsURL = function(extent) {
        return url + '/browse/changesets?bbox=' + extent.toParam();
    };

    connection.entityURL = function(entity) {
        return url + '/browse/' + entity.type + '/' + entity.osmId();
    };

    connection.userURL = function(username) {
        return url + '/user/' + username;
    };

    connection.loadFromURL = function(url, callback) {
        if (inflight++ === 0)
            event.loading();

        return d3.xml(url).get()
            .on('load', function done(dom) {
                callback(null, parse(dom));

                if (--inflight === 0)
                    event.loaded();
            });
    };

    connection.loadExtent = function(extent, callback) {
        return connection.loadFromURL(
            url + '/api/0.6/map?bbox=' + extent.toParam(),
            function(err, entities) {
                event.load(err, {entities: entities, extent: extent});
                if (callback) callback(err, entities);
            });
    };

    connection.loadEntity = function(id, callback) {
        var type = iD.Entity.id.type(id),
            osmID = iD.Entity.id.toOSM(id);

        return connection.loadFromURL(
            url + '/api/0.6/' + type + '/' + osmID + (type !== 'node' ? '/full' : ''),
            function(err, entities) {
                event.load(err, {entities: entities});
                if (callback) callback(err, entities && _.find(entities, function(e) { return e.id === id; }));
            });
    };

    function authenticating() {
        event.authenticating();
    }

    function authenticated() {
        event.authenticated();
    }

    function getNodes(obj) {
        var elems = obj.getElementsByTagName(ndStr),
            nodes = new Array(elems.length);
        for (var i = 0, l = elems.length; i < l; i++) {
            nodes[i] = 'n' + elems[i].attributes.ref.nodeValue;
        }
        return nodes;
    }

    function getTags(obj) {
        var elems = obj.getElementsByTagName(tagStr),
            tags = {};
        for (var i = 0, l = elems.length; i < l; i++) {
            var attrs = elems[i].attributes;
            tags[attrs.k.nodeValue] = attrs.v.nodeValue;
        }
        return tags;
    }

    function getMembers(obj) {
        var elems = obj.getElementsByTagName(memberStr),
            members = new Array(elems.length);
        for (var i = 0, l = elems.length; i < l; i++) {
            var attrs = elems[i].attributes;
            members[i] = {
                id: attrs.type.nodeValue[0] + attrs.ref.nodeValue,
                type: attrs.type.nodeValue,
                role: attrs.role.nodeValue
            };
        }
        return members;
    }

    var parsers = {
        node: function nodeData(obj) {
            var attrs = obj.attributes;
            return new iD.Node({
                id: iD.Entity.id.fromOSM(nodeStr, attrs.id.nodeValue),
                loc: [parseFloat(attrs.lon.nodeValue), parseFloat(attrs.lat.nodeValue)],
                version: attrs.version.nodeValue,
                user: attrs.user && attrs.user.nodeValue,
                tags: getTags(obj)
            });
        },

        way: function wayData(obj) {
            var attrs = obj.attributes;
            return new iD.Way({
                id: iD.Entity.id.fromOSM(wayStr, attrs.id.nodeValue),
                version: attrs.version.nodeValue,
                user: attrs.user && attrs.user.nodeValue,
                tags: getTags(obj),
                nodes: getNodes(obj)
            });
        },

        relation: function relationData(obj) {
            var attrs = obj.attributes;
            return new iD.Relation({
                id: iD.Entity.id.fromOSM(relationStr, attrs.id.nodeValue),
                version: attrs.version.nodeValue,
                user: attrs.user && attrs.user.nodeValue,
                tags: getTags(obj),
                members: getMembers(obj)
            });
        }
    };

    function parse(dom) {
        if (!dom || !dom.childNodes) return new Error('Bad request');

        var root = dom.childNodes[0],
            children = root.childNodes,
            entities = [];

        for (var i = 0, l = children.length; i < l; i++) {
            var child = children[i],
                parser = parsers[child.nodeName];
            if (parser) {
                entities.push(parser(child));
            }
        }

        return entities;
    }

    connection.authenticated = function() {
        return oauth.authenticated();
    };

    // Generate Changeset XML. Returns a string.
    connection.changesetJXON = function(tags) {
        return {
            osm: {
                changeset: {
                    tag: _.map(tags, function(value, key) {
                        return { '@k': key, '@v': value };
                    }),
                    '@version': 0.3,
                    '@generator': 'iD'
                }
            }
        };
    };

    // Generate [osmChange](http://wiki.openstreetmap.org/wiki/OsmChange)
    // XML. Returns a string.
    connection.osmChangeJXON = function(changeset_id, changes) {
        function nest(x, order) {
            var groups = {};
            for (var i = 0; i < x.length; i++) {
                var tagName = Object.keys(x[i])[0];
                if (!groups[tagName]) groups[tagName] = [];
                groups[tagName].push(x[i][tagName]);
            }
            var ordered = {};
            order.forEach(function(o) {
                if (groups[o]) ordered[o] = groups[o];
            });
            return ordered;
        }

        function rep(entity) {
            return entity.asJXON(changeset_id);
        }

        return {
            osmChange: {
                '@version': 0.3,
                '@generator': 'iD',
                'create': nest(changes.created.map(rep), ['node', 'way', 'relation']),
                'modify': nest(changes.modified.map(rep), ['node', 'way', 'relation']),
                'delete': _.extend(nest(changes.deleted.map(rep), ['relation', 'way', 'node']), {'@if-unused': true})
            }
        };
    };

    connection.changesetTags = function(comment, imageryUsed) {
        var tags = {
            imagery_used: imageryUsed.join(';'),
            created_by: 'iD ' + iD.version
        };

        if (comment) {
            tags.comment = comment;
        }

        return tags;
    };

    connection.putChangeset = function(changes, comment, imageryUsed, callback) {
        oauth.xhr({
                method: 'PUT',
                path: '/api/0.6/changeset/create',
                options: { header: { 'Content-Type': 'text/xml' } },
                content: JXON.stringify(connection.changesetJXON(connection.changesetTags(comment, imageryUsed)))
            }, function(err, changeset_id) {
                if (err) return callback(err);
                oauth.xhr({
                    method: 'POST',
                    path: '/api/0.6/changeset/' + changeset_id + '/upload',
                    options: { header: { 'Content-Type': 'text/xml' } },
                    content: JXON.stringify(connection.osmChangeJXON(changeset_id, changes))
                }, function(err) {
                    if (err) return callback(err);
                    oauth.xhr({
                        method: 'PUT',
                        path: '/api/0.6/changeset/' + changeset_id + '/close'
                    }, function(err) {
                        callback(err, changeset_id);
                    });
                });
            });
    };

    var userDetails;

    connection.userDetails = function(callback) {
        if (userDetails) {
            callback(undefined, userDetails);
            return;
        }

        function done(err, user_details) {
            if (err) return callback(err);

            var u = user_details.getElementsByTagName('user')[0],
                img = u.getElementsByTagName('img'),
                image_url = '';

            if (img && img[0] && img[0].getAttribute('href')) {
                image_url = img[0].getAttribute('href');
            }

            userDetails = {
                display_name: u.attributes.display_name.nodeValue,
                image_url: image_url,
                id: u.attributes.id.nodeValue
            };

            callback(undefined, userDetails);
        }

        oauth.xhr({ method: 'GET', path: '/api/0.6/user/details' }, done);
    };

    connection.status = function(callback) {
        function done(capabilities) {
            var apiStatus = capabilities.getElementsByTagName('status');
            callback(undefined, apiStatus[0].getAttribute('api'));
        }
        d3.xml(url + '/api/capabilities').get()
            .on('load', done)
            .on('error', callback);
    };

    connection.switch = function(options) {
        url = options.url;
        oauth.options(_.extend({
            loading: authenticating,
            done: authenticated
        }, options));
        event.auth();
        return connection;
    };

    connection.logout = function() {
        oauth.logout();
        event.auth();
        return connection;
    };

    connection.authenticate = function(callback) {
        function done(err, res) {
            event.auth();
            if (callback) callback(err, res);
        }
        return oauth.authenticate(done);
    };

    return d3.rebind(connection, event, 'on');
};
