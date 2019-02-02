window.addEventListener("load", function() {
	/*** globals ***/
		/* defaults */
			document.addEventListener("dblclick", function(event) {
				event.preventDefault()
			})

			document.addEventListener("contextmenu", function(event) {
				event.preventDefault()
			})

		/* triggers */
			if ((/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i).test(navigator.userAgent)) {
				var on = { click: "touchstart", mousedown: "touchstart", mousemove: "touchmove", mouseup: "touchend" }
			}
			else {
				var on = { click:      "click", mousedown:  "mousedown", mousemove: "mousemove", mouseup:  "mouseup" }
			}

		/* variables */
			var canvas      = document.getElementById("canvas")
			var context     = canvas.getContext("2d")
			var counter     = 0
			var drops       = {}
			var socket      = null
			var audio       = null
			var master      = null
			var frequencies = [
				130.81, 146.83, 164.81, 196.00, 220.00,
				261.63, 293.67, 329.63, 392.00, 440.00, 
				523.25, 587.33, 659.25, 783.99, 880.00,
				1046.50
			]
			var envelope = {
				attack:  0.005,
				decay:   0.01,
				sustain: 0.5,
				release: 1
			}

		/* generateRandom */
			function generateRandom() {
				var set = "abcdefghijklmnopqrstuvwxyz"

				var output = ""
				for (var i = 0; i < 32; i++) {
					output += (set[Math.floor(Math.random() * set.length)])
				}

				return output
			}

	/*** websocket ***/
		/* socket */
			createSocket()
			function createSocket() {
				socket = new WebSocket(location.href.replace("http","ws"))
				socket.onopen = function() { socket.send(null) }
				socket.onerror = function(error) {}
				socket.onclose = function() {
					socket = null
				}

				socket.onmessage = function(message) {
					try {
						var post = JSON.parse(message.data)
						if (post && (typeof post == "object")) {
							updateScene(post)
						}
					}
					catch (error) {}
				}
			}

		/* checkLoop */
			var checkLoop = setInterval(function() {
				if (!socket) {
					try {
						createSocket()
					}
					catch (error) {}
				}
				else {
					clearInterval(checkLoop)
				}
			}, 5000)

	/*** inputs ***/
		/* submitPosition */
			document.addEventListener(on.mousemove, submitPosition)
			document.addEventListener(on.click, submitPosition)
			function submitPosition(event) {
				try {
					if (socket) {
						// coordinates
							var x = event.touches ? event.touches[0].clientX : event.clientX
							var y = event.touches ? event.touches[0].clientY : event.clientY

						// socket
							socket.send(JSON.stringify({
								action: "submitPosition",
								x: x,
								y: y
							}))
					}
				}
				catch (error) {}
			}

	/*** scene ***/
		/* updateScene */
			function updateScene(clouds) {
				if (audio) {
					// counter
						counter = counter ? counter - 1 : 119

					// clear
						context.clearRect(0, 0, canvas.width, canvas.height)

					// drops
						for (var i in drops) {
							updateDrop(drops[i])
							drawDrop(drops[i])
						}

					// clouds
						for (i in clouds) {
							var x = clouds[i].x
							var y = clouds[i].y

							drawCloud(x, y)
							createDrop(clouds[i])
						}
				}
			}

		/* createDrop */
			function createDrop(cloud) {
				var sector = Math.floor(6 * (canvas.height - cloud.y) / canvas.height) + 1
				if (counter % sector == 0) {
					// create drop
						var drop = {
							id: generateRandom(),
							x: cloud.x + (Math.floor(Math.random() * 200) - 100),
							y: Math.max(125, Math.min(canvas.height - 100, cloud.y)),
							vy: 20,
							frequency: frequencies[Math.floor(16 * cloud.x / canvas.width)]
						}

					// add to drops object
						drops[drop.id] = drop
				}
			}

		/* updateDrop */
			function updateDrop(drop) {
				// move down
					drop.y += drop.vy

				// play sound
					if (drop.y >= canvas.height && !drop.oscillator) {
						drawSplat(drop)
						playTone(drop)
					}
			}

	/*** canvas ***/
		/* resizeCanvas */
			resizeCanvas()
			window.addEventListener("resize", resizeCanvas)
			function resizeCanvas(){
				canvas.height = window.innerHeight
				canvas.width = window.innerWidth
			}

		/* draw triangle */
			function drawTriangle(x, y, width, height, color) {
				context.beginPath()
				context.fillStyle = color
				context.moveTo(x, y)
				context.lineTo(x + width, y)
				context.lineTo(x + (width * 0.5), y - height)
				context.closePath() // or context.lineTo(x, y)
				context.fill()
			}

		/* drawRectangle */
			function drawRectangle(x, y, width, height, color) {
				context.beginPath()
				context.fillStyle = color
				context.moveTo(x, y)
				context.lineTo(x + width, y)
				context.lineTo(x + width, y + height)
				context.lineTo(x, y + height)
				context.closePath() // or context.lineTo(x, y)
				context.fill()
			}

		/* drawCircle */
			function drawCircle(x, y, radius, color) {
				context.beginPath()
				context.fillStyle = color
				context.arc(x, y, radius, 0, Math.PI *2)
				context.fill()
			}

		/* drawCloud */
			function drawCloud(x, y) {
				y = Math.max(125, Math.min(canvas.height - 100, y))

				// color
					var yPercent = (canvas.height - y) / canvas.height 
					var red = yPercent * 255
					var green = yPercent * 255
					var blue = yPercent * 255
					var color = "rgb(" + red + ", " + green + ", " + blue + ")"

				// shape
					drawRectangle(x - 100, y - 50, 200, 80, color)
					drawCircle(x - 100, y - 50 + 40, 40, color)
					drawCircle(x - 100 + 200, y - 50 + 40, 40, color)
					drawCircle(x - 100 + 70, y - 50, 70, color)
					drawCircle(x - 100 + 150, y - 50 + 10, 50, color)
			}

		/* drawDrop */
			function drawDrop(drop) {
				drawTriangle(drop.x - 12.5, drop.y, 25, 40, "lightblue")
				drawCircle(drop.x, drop.y, 12.5, "lightblue")
			}

		/* drawSplat */
			function drawSplat(drop) {
				var x = drop.x
				var y = canvas.height + 5

				drawCircle( (x - 30), y - 25,   2, "lightblue")
				drawCircle( (x - 20), y - 20,   2, "lightblue")
				drawCircle( (x - 10), y - 15,   3, "lightblue")

				drawCircle( (x - 30), y -  5,   2, "lightblue")
				drawCircle( (x - 15), y -  5,   3, "lightblue")
				drawCircle( (x - 5),  y,      2.5, "lightblue")

				drawCircle( (x + 5),  y,      2.5, "lightblue")
				drawCircle( (x + 15), y -  5,   3, "lightblue")
				drawCircle( (x + 30), y -  5,   2, "lightblue")

				drawCircle( (x + 10), y - 15,   3, "lightblue")
				drawCircle( (x + 20), y - 20,   2, "lightblue")
				drawCircle( (x + 30), y - 25,   2, "lightblue")
			}

	/*** audio ***/
		/* buildAudio */
			document.getElementById("start").addEventListener(on.click, buildAudio)
			function buildAudio() {
				if (!audio) {
					// remove start button
						document.getElementById("start").remove()
						document.body.style["cursor"] = "none"

					// audio context
						audio = new (window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.oAudioContext || window.msAudioContext)()

					// master volume
						master = audio.createGain()
						master.connect(audio.destination)
						master.gain.setValueAtTime(0.8, audio.currentTime)
				}
			}

		/* playTone */
			function playTone(drop) {
				setTimeout(function() {
					if (audio) {
						// gain
							drop.envelope = audio.createGain()
							drop.envelope.connect(master)
							drop.envelope.gain.setValueAtTime(0, audio.currentTime)

						// sine wave
							drop.oscillator = audio.createOscillator()
							drop.oscillator.connect(drop.envelope)
							drop.oscillator.type = "sine"
							drop.oscillator.frequency.setValueAtTime(drop.frequency || 440, audio.currentTime)
							drop.oscillator.start()

						// envelope
							drop.envelope.gain.linearRampToValueAtTime(1, audio.currentTime + envelope.attack)
							drop.envelope.gain.exponentialRampToValueAtTime(envelope.sustain, audio.currentTime + envelope.decay)
							drop.envelope.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + envelope.release - 0.001)
							drop.envelope.gain.linearRampToValueAtTime(0, audio.currentTime + envelope.release)

						// remove
							setTimeout(function() {
								drop.oscillator.stop()
								delete drops[drop.id]
							}, envelope.release * 1000)
					}
				}, 0)
			}
})