/*** modules ***/
	var http = require("http")
	var fs   = require("fs")
	var util = require("util")
	var qs   = require("querystring")
	var ws   = require("websocket").server

	var main = require("./logic")
	var db   = {}
	var loop = setInterval(updateClients, 50)

/*** server ***/
	var port = main.getEnvironment("port")
	var server = http.createServer(handleRequest)
		server.listen(port, function (error) {
			if (error) {
				main.logError(error)
			}
			else {
				main.logStatus("listening on port " + port)
			}
		})

/*** socket ***/
	var socket = new ws({
		httpServer: server,
		autoAcceptConnections: false
	})
		socket.on("request", handleSocket)

/*** handleRequest ***/
	function handleRequest(request, response) {
		// collect data
			var data = ""
			request.on("data", function (chunk) { data += chunk })
			request.on("end", parseRequest)

		/* parseRequest */
			function parseRequest() {
				try {
					// get request info
						request.get    = qs.parse(request.url.split("?")[1]) || {}
						request.path   = request.url.split("?")[0].split("/") || []
						request.url    = request.url.split("?")[0] || "/"
						request.post   = data ? JSON.parse(data) : {}
						request.cookie = request.headers.cookie ? qs.parse(request.headers.cookie.replace(/; /g, "&")) : {}
						request.ip     = request.headers["x-forwarded-for"] || request.connection.remoteAddress || request.socket.remoteAddress || request.connection.socket.remoteAddress

					// log it
						if (request.url !== "/favicon.ico") {
							main.logStatus((request.cookie.session || "new") + " @ " + request.ip + "\n[" + request.method + "] " + request.path.join("/") + "\n" + JSON.stringify(request.method == "GET" ? request.get : request.post))
						}

					// where next ?
						if ((/[.](ico|png|jpg|jpeg|gif|svg|pdf|txt|css|js)$/).test(request.url)) { // serve asset
							routeRequest()
						}
						else { // get session and serve html
							main.determineSession(request, routeRequest)
						}
				}
				catch (error) {_403("unable to parse request")}
			}

		/* routeRequest */
			function routeRequest() {
				try {
					// assets
						if (!request.session) {
							switch (true) {
								// icon
									case (/\/favicon[.]ico$/).test(request.url):
									case (/\/icon[.]png$/).test(request.url):
									case (/\/apple\-touch\-icon[.]png$/).test(request.url):
									case (/\/apple\-touch\-icon\-precomposed[.]png$/).test(request.url):
									case (/\/logo[.]png$/).test(request.url):
									case (/\/banner[.]png$/).test(request.url):
										try {
											response.writeHead(200, {"Content-Type": "image/png"})
											fs.readFile("./logo.png", function (error, file) {
												if (error) {_404(error)}
												else {
													response.end(file, "binary")
												}
											})
										}
										catch (error) {_404(error)}
									break

								// stylesheet
									case (/\/stylesheet[.]css$/).test(request.url):
										try {
											response.writeHead(200, {"Content-Type": "text/css"})
											fs.readFile("./stylesheet.css", "utf8", function (error, file) {
												if (error) { _404(error) }
												else {
													response.end(file)
												}
											})
										}
										catch (error) {_404(error)}
									break

								// script
									case (/\/script[.]js$/).test(request.url):
										try {
											response.writeHead(200, {"Content-Type": "text/javascript"})
											fs.readFile("./script.js", "utf8", function (error, file) {
												if (error) {_404(error)}
												else {
													response.end(file)
												}
											})
										}
										catch (error) {_404(error)}
									break

								// others
									default:
										_404()
									break
							}
						}
						
					// get
						else if (request.method == "GET") {
							response.writeHead(200, {
								"Set-Cookie": String( "session=" + request.session.id + "; expires=" + (new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 7)).toUTCString()) + "; path=/; domain=" + main.getEnvironment("domain") ),
								"Content-Type": "text/html; charset=utf-8"
							})

							switch (true) {
								// home
									case (/^\/$/).test(request.url):
										try {
											main.renderHTML(request, "./index.html", function (html) {
												response.end(html)
											})
										}
										catch (error) {_404(error)}
									break

								// others
									default:
										_404()
									break
							}
						}

					// post
						else if (request.method == "POST") {
							_403("unknown action")
						}

					// others
						else {_403("unknown route")}
				}
				catch (error) {_403("unable to route request")}
			}

		/* _302 */
			function _302(data) {
				main.logStatus("redirecting to " + (data || "/"))
				response.writeHead(302, { Location: data || "../../../../" })
				response.end()
			}

		/* _403 */
			function _403(data) {
				main.logError(data)
				response.writeHead(403, { "Content-Type": "text/json" })
				response.end( JSON.stringify({success: false, error: data}) )
			}

		/* _404 */
			function _404(data) {
				main.logError(data)
				response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" })
				response.end( JSON.stringify({success: false, error: data}) )
			}
	}

/*** handleSocket ***/
	function handleSocket(request) {
		// collect data
			if ((request.origin.replace("https://","").replace("http://","") !== main.getEnvironment("domain")) && (request.origin !== "http://" + main.getEnvironment("domain") + ":" + main.getEnvironment("port"))) {
				main.logStatus("[REJECTED]: " + request.origin + " @ " + (request.socket._peername.address || "?"))
				request.reject()
			}
			else if (!request.connection) {
				request.connection = request.accept(null, request.origin)
				parseSocket()
			}
			else {
				parseSocket()
			}

		/* parseSocket */
			function parseSocket() {
				try {
					// get request info
						request.url     = (request.httpRequest.headers.host || "") + (request.httpRequest.url || "")
						request.path    = request.httpRequest.url.split("?")[0].split("/") || []
						request.cookie  = request.httpRequest.headers.cookie ? qs.parse(request.httpRequest.headers.cookie.replace(/; /g, "&")) : {}
						request.headers = {}
						request.headers["user-agent"] = request.httpRequest.headers['user-agent']
						request.headers["accept-language"] = request.httpRequest.headers['accept-language']
						request.ip      = request.connection.remoteAddress || request.socket._peername.address

					// log it
						main.logStatus((request.cookie.session || "new") + " @ " + request.ip + "\n[WEBSOCKET] " + request.path.join("/"))

					// get session and wait for messages
						main.determineSession(request, routeSocket)
				}
				catch (error) {_400("unable to parse socket")}
			}

		/* routeSocket */
			function routeSocket() {
				try {
					// on connect
						db[request.session.id] = request
						request.x = 0
						request.y = 0

					// on close
						request.connection.on("close", function (reasonCode, description) {
							delete db[request.session.id]
						})
					
					// on message
						request.connection.on("message", function (message) {
							// get post data
								request.post = null
								try { request.post = JSON.parse(message.utf8Data) || null }
								catch (error) {main.logError(error)}

							if (request.post && request.post.action) {
								db[request.session.id].x = Number(request.post.x)
								db[request.session.id].y = Number(request.post.y)
							}
						})

					
				}
				catch (error) {_400("unable to route socket")}
			}

		/* _400 */
			function _400(data) {
				main.logError(data)
				request.connection.sendUTF(JSON.stringify({success: false, message: (data || "unknown websocket error")}))
			}
	}

/*** updateClients ***/
	function updateClients() {
		try {
			// data
				var data = {}
				for (var r in db) {
					data[r] = {
						x: db[r].x,
						y: db[r].y
					}
				}
				data = JSON.stringify(data)

			// send
				for (var r in db) {
					try {
						db[r].connection.sendUTF(data)
					}
					catch (error) {main.logError(error)}
				}
		}
		catch (error) {main.logError("error")}
	}
