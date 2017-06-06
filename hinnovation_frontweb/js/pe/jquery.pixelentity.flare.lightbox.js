(function ($) {
	/*jslint undef: false, browser: true, devel: false, eqeqeq: false, bitwise: false, white: false, plusplus: false, regexp: false, nomen: false */ 
	/*global jQuery,setTimeout,location,setInterval,YT,clearInterval,clearTimeout,pixelentity,Spinner */
	
	$.pixelentity = $.pixelentity || {version: '1.0.0'};
	
	$.pixelentity.peFlareLightbox = {	
		conf: {
			api: false,
			captions: true,
			delay: 0,
			preloadFont: true,
			videoWidth: 0,
			titleAttr: "title",
			descriptionAttr: "data-description",
			descriptionElement: "p.peFlareDescription"
		} 
	};

	$.pixelentity.video.fallbackPlayer = "js/pe.flare/video/jarisplayer.swf";
	
	var ua = navigator.userAgent.toLowerCase();
	var vimeoCover =  /http:\/\/(vimeo\.com|www\.vimeo\.com)\//i;
	
	var offset = {
			none: {
				from: 0,
				to: 0
			},
			prev: {
				from: -100,
				to: 0
			},
			next: {
				from: 100,
				to: 0
			}
		};
	
	function Lightbox() {
		
		var conf;
		var inited = false;
		var built = false;
		var jwin;
		var w,h;
		var overlay;
		var active = false;
		var overlayActive = false;
		var rendered = false;
		var useTransitions = $.support.csstransitions;
		var useTransitionEnd = $.support.csstransitionsEnd;
		var spinner,content;
		var modules = [];
		var rendererList = [];
		var renderers = {};
		var targets = [];
		var items = [];
		var galleries = {};
		var loadQueue = [];
		var displayList = [];
		var loaded = 0;
		var hiddenBuffer;
		var currentGallery = false;
		var currentGalleryPos = 0;
		var currentID = -1;
		var needDisplayListClear = false;
		var rendererID = 1;
		var direction = "none";
		var touchX,touchAmountX,touchScrollX;
		var spinnerTimeout = 0;
		var locked = 0;
		var thumbs;
		var thumbsInnerContainer;
		var thumbsActive = false;
		var thumbsAutoHide;
		var thumbsStart = 0;
		var thumbsScrollAmount = 0;
		var videoResource = false;
		var videoIcon, videoOverlay, captionsOverlay;
		var player;
		var showVideoTimer = 0;
		var isAbsolute = false;
		var oldCaptions = false;
		var slideshowTimer = 0;
	
		function resize() {
			w = jwin.width();
			h = window.innerHeight ? window.innerHeight: jwin.height();
			if (overlay) {
				overlay.width(w).height(h);
				if (isAbsolute) {
					overlay.css("top",jwin.scrollTop());
				}
			}
			if ($.pixelentity.browser.mobile && thumbs && thumbs.data("count") > 0) {
				scrollThumbs(thumbsStart,true);
			}
			var i = displayList.length;
			while (i--) {
				displayList[i].resize(w,h);
			}
			
			resizeCaptions();
			resizeVideo();
		}
		
		function register(module,name) {
			modules[name] = module;
		}
	
		function thumbsHandler(e) {
			clearTimeout(thumbsAutoHide);
			var over = items[currentID].thumbover;
			switch (e.type) {
			case "mouseenter":
				if (over) {
					showHideThumbs(true);
				}
				break;
			case "mouseleave":
				if (over) {
					showHideThumbs(false);
				}
				break;
			case "click":
				var id = e.currentTarget.id;
				if (!locked && id) {
					id = parseInt(id,10);
					if (currentID >= 0) {
						direction = id > currentID ? "next" : "prev";
					}
					process(id);
				}
				e.stopPropagation();
				e.stopImmediatePropagation();
				return false;
			}
		}

		
		function mousemoveHandler(e) {
			clearTimeout(thumbsAutoHide);
			var pos = e ? e.pageX : 0;
			var total = thumbs.data("width");
			var delta = total-w;
			if (delta >= 0) {
				pos = -delta*pos/w;
				thumbsInnerContainer.css("margin-left",pos);				
			} else {
				thumbsInnerContainer.css("margin-left","auto");
			}
		}
		
		function scrollThumbs(pos,absolute) {
			var size = thumbs.data("size");
			var page = Math.floor(w/size);
			var after;
			var offset = 0;
			if (thumbs.data("width") > w) {
				if (absolute) {
					thumbsStart = pos;
				} else {
					thumbsStart = Math.max(0,thumbsStart+pos*page);
				}				
				if ((after = thumbs.data("count")-thumbsStart) < page) {
					thumbsStart -= (page-after+1);
					offset = w-page*size-size-8;
				}
			} else {
				thumbsStart = 0;
			}
			thumbsScrollAmount = -thumbsStart*size+offset;
			thumbsInnerContainer.transform(1,thumbsScrollAmount === 0 ? 0 : thumbsScrollAmount-2,0);
		}
		
		
		function touchHandler(e) {
			if (!active || player) {
				return true;
			}
			
			var type = e.type;
			var te = e.originalEvent;
			
			
			switch (type) {
			case "touchstart":
				if(te.touches.length > 1 || te.scale && te.scale !== 1) {
					return true;
				}
				touchX = te.touches[0].pageX;
				touchAmountX = 0;
				break;
			case "touchmove":
				if(te.touches.length > 1 || te.scale && te.scale !== 1) {
					return true;
				}
				//stopTimer();
				touchAmountX = (te.touches[0].pageX - touchX);
				
				e.preventDefault();
				e.stopPropagation();
				if (thumbsActive) {
					thumbsInnerContainer.addClass("touchMove").transform(1,thumbsScrollAmount + touchAmountX,0);
				}
				break;
			case "touchend":
				
				if (thumbsActive) {
					thumbsInnerContainer.removeClass("touchMove");
				}
				
				if (touchAmountX === 0) {
					return false;
				}
				
				var jumped = false;
				
				if (touchAmountX > 10 /*&& current > 0*/) {
					jumped = true;
					if (!thumbsActive) {
						prev();						
					} else {
						scrollThumbs(-1);
					}
				}
				
				if (touchAmountX < -10 /*&& current < (max-conf.count)*/) {
					jumped = true;
					if (!thumbsActive) {
						next();						
					} else {
						scrollThumbs(+1);
					}
				} 
				
				/*
				if (!jumped) {
					jumpTo(current);
				}
				*/
				
				touchAmountX = 0;
				
				break;
			}
			
			return true;
		}
		
		function disableBodyScroll(e) {
			if (!active) {
				return true;
			}
			e.preventDefault();
			e.stopPropagation();
			return false;
		}
		
		function next() {
			if (locked || !currentGallery) {
				return;
			}
			direction = "next";
			process(currentGallery[(currentGalleryPos + 1) % currentGallery.length]);
		}
		
		function prev() {
			if (locked || !currentGallery) {
				return;
			}
			direction = "prev";
			process(currentGallery[currentGalleryPos === 0 ? currentGallery.length-1 : currentGalleryPos-1]);
		}
		
		function showHideCaptions(status) {
			// find tallest caption
			var maxH = captionsOverlay.find("> div:last").outerHeight() || 500;
			
			status = currentGallery ? status : false;
			
			if (useTransitionEnd) {
				captionsOverlay.css({"top" : (status ? maxH : 0)});
			} else {
				captionsOverlay.stop().animate({"top" : (status ? maxH : 0)},500);
			}
			
		}

		
		function showHideThumbs(status) {
			var  tp = thumbs.parent();
			thumbsActive = status === true ? true : (status === false ? false : (thumbsActive ? false : true));
			showHideCaptions(thumbsActive);
			if (useTransitionEnd) {
				tp[thumbsActive ? "addClass" : "removeClass"]("peFlareLightboxActive");
			} else {
				tp.stop().animate({"margin-top" : (thumbsActive ? -84 : 0)},500);
			}
		}
		
		function resizeCaption() {
			var c = captionsOverlay.find(this);
			c.css("top",h-c.outerHeight());
			//c.css("top",0);
			//c.css("top",(h-c.outerHeight())/2);
		}

		
		function resizeCaptions() {
			captionsOverlay.find("> div").each(resizeCaption);
		}
		
		function resizeVideo() {
			if (videoOverlay.hasClass("peFlareLightboxActive")) {
				if (true || $.pixelentity.browser.mobile || videoResource.videoType == "youtube" || videoResource.videoType == "vimeo") {
					var mtop = $.pixelentity.browser.iDev ? 35 : 0;
					var vh = $.pixelentity.browser.android ? w*9/16 : h;
					vh = Math.min(vh,h);
					
					var vtarget = videoOverlay.find("iframe, video");
					var maxW = items[currentID].videoWidth;
					
					if (maxW) {
						vh = Math.min(vh,Math.min(w,maxW)*9/16);						
					}
					
					if (maxW && maxW < w) {
						vtarget.width(maxW).css("margin-left",(w-maxW)/2);
					} else {
						vtarget.width("100%").css("margin-left",0);
					}
					vtarget.css("margin-top",(h-vh)/2+mtop).height(vh-mtop);
					
					
					//videoOverlay.find("iframe, video").css("margin-top",(h-vh)/2+offset).height(vh-offset).width("100%");	
					//videoOverlay.find("iframe, video").css("max-width",500);	

				} else {
					player.resize(w,h);
				}
			}
		}
		
		
		function showVideo() {
			clearTimeout(showVideoTimer);
			player.unbind("video_ready.pixelentity",showVideo);
			spinner.hide();
			videoOverlay.addClass("peFlareLightboxActive");
			resizeVideo();
			if (($.pixelentity.browser.webkit || $.pixelentity.browser.iDev) && (videoResource.videoType == "vimeo" || videoResource.videoType == "youtube")) {
				isAbsolute = true;
				overlay.css({
					"position": "absolute",
					"top": jwin.scrollTop()
				});
			}
		}
		
		function stopVideo() {
			clearTimeout(showVideoTimer);
			if (player) {
				if (player.destroy) {
					player.destroy();
				}
				player = false;
				videoOverlay.removeClass("peFlareLightboxActive").empty();
				videoIcon.addClass("peFlareLightboxActive");
			}
			if (isAbsolute) {
				isAbsolute = false;
				overlay.css({
					"position": "fixed",
					"top": 0
				});
			}
		}

		function closeButton() {
			if (player) {
				stopVideo();
				videoIcon.addClass("peFlareLightboxActive");
				if (!currentGallery) {
					close();
				}
			} else {
				close();					
			}		
		}
		
		function createVideo() {
			spinner.show();
			videoIcon.removeClass("peFlareLightboxActive");
			player = videoOverlay.peVideo({
				api: true,
				//useVideoTag: $.pixelentity.browser.mobile,
				useVideoTag: true,
				disableFade: true,
				width: w,
				height: h,
				type    : videoResource.videoType,
				videoId : videoResource.video,
				poster: $.pixelentity.browser.mobile && videoResource.videoPoster,
				hd: true,
				autoPlay:true,
				loop:false
			});
			player.one("video_ready.pixelentity",showVideo);
			showVideoTimer = setTimeout(showVideo,5000);
			//player.one("video_ended.pixelentity",stopVideo);
		}

		
		function controlsHandler(e) {
			if (!active || !overlayActive) {
				return true;
			}
			switch(e.currentTarget.id) {
			case "peFlareLightboxControlClose":
				closeButton();
				break;
			case "peFlareLightboxControlNext":
				next();
				break;
			case "peFlareLightboxControlPrev":
				prev();
				break;
			case "peFlareLightboxControlThumbs":
				showHideThumbs();
				break;
			case "peFlareLightboxControlVideo":
				createVideo();
				break;
			}
			e.stopPropagation();
			e.stopImmediatePropagation();
			return false;
		}
		
		function navHandler(e,delta) {
			if (!active || !overlayActive) {
				return true;
			}
			if (e.type == "keydown") {
				switch (e.keyCode) {
				case 27:
					// ESC
					closeButton();
					break;
				case 39:
					// right arrow
					next();
					break;
				case 37:
					// left arrow
					prev();
					break;
				}
			} else {
				// mousewheel
				if (!player) {
					if (delta < 0) {
						next();
					} else {
						prev();
					}					
				}
			}
			e.preventDefault();
			e.stopPropagation();
			return false;
		}

		
		function init(c) {
			if (inited) {
				return true;
			}
			inited = true;
			conf = c;
			
			if (conf.preloadFont) {
				var p = $('<p class="peFlareLightboxFontPreload">.</p>');
				$("body").append(p);
				setTimeout(function () {
					p.detach().empty();
				},100);
			}
			
			return true;
		}
		
		function scroll(e) {
			if (!active) {
				return;
			}
			if (isAbsolute) {
				overlay.css("top",jwin.scrollTop());
			}
		}

		
		function build() {
			if (built) {
				return true;
			}
			built = true;
			jwin = $(window).resize(resize);
			jwin.scroll(scroll);
			overlay = $('<div class="peFlareLightbox"><div class="peFlareLightboxHidden"></div><div class="peFlareLightboxControls"><div><a href="#" class="sprite" id="peFlareLightboxControlClose"/><a href="#" class="sprite" id="peFlareLightboxControlNext"/><a href="#" class="sprite" id="peFlareLightboxControlPrev"/><a href="#" class="sprite" id="peFlareLightboxControlThumbs"/></div></div><div class="peFlareLightboxOverlay"></div><div class="peFlareLightboxContent"></div><div class="peFlareLightboxCaptions"></div><div class="peFlareLightboxThumbs"><span></span></div><a id="peFlareLightboxControlVideo" class="peFlareLightboxVideoIcon"><span></span></a><div class="peFlareLightboxVideo"></div><div class="peFlareLightboxSpinner"><span/></div></div>');
			if (!useTransitions) {
				overlay.addClass("no-transitions");
			}
			
			if ($.browser.msie) {
				overlay.addClass("msie");
			}
			
			$("body").append(overlay).bind("touchmove",disableBodyScroll);
			
			spinner = overlay.find(".peFlareLightboxSpinner").hide();
			content = overlay.find(".peFlareLightboxContent");
			videoIcon = overlay.find(".peFlareLightboxVideoIcon");
			videoOverlay = overlay.find(".peFlareLightboxVideo");
			captionsOverlay = overlay.find(".peFlareLightboxCaptions");
			
			thumbs = $("<div/>");
			if ($.pixelentity.browser.mobile) {
				overlay.addClass("mobile");
				overlay.find(".peFlareLightboxThumbs").append(thumbs);				
			} else {
				overlay.addClass("desktop");
				overlay.find(".peFlareLightboxThumbs").bind("mouseenter mouseleave",thumbsHandler).append(thumbs);
			}
			hiddenBuffer = overlay.find(".peFlareLightboxHidden");
			
			overlay
				.bind("touchstart touchmove touchend",touchHandler)
				.bind("mousewheel",navHandler)
				.delegate(".peFlareLightboxControls a","click touchstart",controlsHandler)
				.delegate(".peFlareLightboxThumbs span","click",thumbsHandler);
			
			videoIcon.click(controlsHandler);
			
			if (!$.pixelentity.browser.mobile) {
				thumbs.bind("mousemove",mousemoveHandler);
			} else {
				overlay.click(showHideThumbs);
			}
			
			$(document).bind("keydown",navHandler);

		}

		
		function overlayReady() {
			overlayActive = true;
			overlay.css("filter","none");
			if (thumbs.data("created")) {
				showHideThumbs(true);
				thumbsAutoHide = setTimeout(showHideThumbs,2000);
			}
			if (loadQueue.length === loaded) {
				render();
			}
		}

		
		function fadeIn() {
			overlay.addClass("peFlareLightboxActive");
			if (useTransitions) {
				//overlay.one(useTransitionEnd,overlayReady);
				setTimeout(overlayReady,600);
			} else {
				overlay.stop().css("opacity",0).fadeTo(500,1,overlayReady);				
			}
		}
		
		function open() {
			$.pixelentity.peFlareLightbox.active = active = true;
			locked = 0;
			build();
			resize();
			jwin.scrollLeft(0);
			overlay.show();
			setTimeout(fadeIn,10);
			// stop all videos
			$(".peVideo.peActiveWidget").trigger("disable.pixelentity");
		}
		
		function clean() {
			$.pixelentity.peFlareLightbox.active = active = false;
			currentGallery = false;
			locked = false;
			loadQueue = [];
			currentID = -1;
			stopVideo();
			overlay.hide();
			content.empty();
			captionsOverlay.empty();
			var rID,renderer;
			// remove all renderers in display list
			while ((renderer = displayList.shift())) {
				renderer.destroy();
			}
			// remove any renderer left
			while ((rID = rendererList.shift())) {
				renderers[rID].destroy();
			}
			thumbs.data("created",false).empty();
			overlay.removeClass("peFlareLightboxActive");
			videoIcon.removeClass("peFlareLightboxActive");
			direction = "none";
		}

		
		function close(e) {
			overlayActive = false;
			if (useTransitions) {
				// too risky with event name changes ... let's stick with good ol' setTimeout
				if (false && useTransitionEnd) {
					overlay.one(useTransitionEnd,clean);
				} else {
					setTimeout(clean,600);
				}	
				overlay.removeClass("peFlareLightboxActive");				
			} else {
				//overlay.removeClass("peFlareLightboxActive");
				overlay.stop().css("opacity",1).fadeTo(500,0,clean);
			}
		}
		
		function delayedSpinnerShow() {
			spinner.show();
		}

		
		function showSpinner() {
			spinnerTimeout = setTimeout(delayedSpinnerShow,500);
		}
		
		function hideSpinner() {
			clearTimeout(spinnerTimeout);
			spinner.hide();
		}
		
		function createThumbs() {
			if (!currentGallery || thumbs.data("created") === true) {
				return;
			}
			var thumb,id;
			thumbsInnerContainer = $("<div/>");
			thumbs.empty().append(thumbsInnerContainer);
			var count = 0;
			for (var i=0;i<currentGallery.length;i++) {
				id = currentGallery[i];
				
				if ((thumb = items[id].thumb)) {
					thumb = $("<span/>").attr("data-src",thumb).attr("id",id);
					thumbsInnerContainer.append(thumb);
					thumb.peSimpleThumb();
					count++;
				}
			}
			var tiw = count*(104)+10;
			thumbsInnerContainer.width(tiw);
			thumbs.data("count",count);
			thumbs.data("size",104); 
			if (count > 0) {
				thumbs.data("created",true);				
				thumbs.data("width",tiw);				
			} else {
				overlay.find("#peFlareLightboxControlThumbs").hide();
			}
		}
		
		
		function vimeoPosterUrlLoaded(data) {
			hideSpinner();
			var id = currentID;
			items[id].resource = (data && data[0] && data[0].thumbnail_large) || false;
			currentID = -1;
			process(id);
		}
		
		function filter(gallery) {
			if (typeof gallery !== "object") return gallery;
			var i = 0, n = gallery.length,id,target;
			var filtered = [];
			
			for(;i<n;i++) {
			
				id = gallery[i];
				target = items[id].target;
				
				if (target.hasClass("flare-hidden") || target.closest(".peIsotopeItem.isotope-hidden").length > 0) {
					// skip targets inside hidden isotope elements
					continue;
				}
				
				filtered.push(id);
				
			}
			return filtered;
		}
		
		function process(id) {
			var item = items[id];
			
			overlay.find(".peFlareLightboxThumbs > span")[item.thumbover ? "show" : "hide"]();
			
			// check if damn vimeo cover (json)
			if (item.resource.match(vimeoCover)) {
				currentID = id;
				showSpinner();
				$.getJSON(item.resource,vimeoPosterUrlLoaded);
				return false;
			}
			
			if (id === currentID) {
				rendered = true;
				loaded = 0;
				return false;
			}
			currentID = id;
			
			stopVideo();
			
			currentGallery = item.gallery ? filter(galleries[item.gallery]) : false;
			currentGallery = currentGallery.length > 1 ? currentGallery : false; 
			
			overlay.find("#peFlareLightboxControlPrev,#peFlareLightboxControlNext,#peFlareLightboxControlThumbs")[currentGallery && currentGallery.length > 1 ? "show" : "hide"]();
			
			if (currentGallery) {
				currentGalleryPos = $.inArray(id,currentGallery);
				createThumbs();
			}
			
			rendered = false;
			loaded = 0;

			var rID;
			var renderer,Module;
			
			// we have a gallery render here
			if (rendererList.length > 0 && (renderer = renderers[rendererList[0]]).isGallery) {
				rID = rendererList[0];
				needDisplayListClear = false;
			} else {			
				rID = rendererID++;
				Module  = modules[item.plugin] || modules["default"];
				renderer = new Module(rID,w,h);
				renderers[rID] = renderer;
				rendererList.push(rID);
				needDisplayListClear = true;
			}
			
			videoResource = item.video ? item : false;
			if (!videoResource) {
				videoIcon.removeClass("peFlareLightboxActive");				
			}
			loadQueue.push(rID);
						
			showSpinner();
			renderer.load(item);
		}

		
		function click(e) {
			var el = e.currentTarget;
			var linkID = parseInt(el.getAttribute("data-pe-flare-id" || 0),10);
			var linkGallery = el.getAttribute("data-pe-flare-gallery");
			var tID;
			if (linkGallery && linkID >= 0) {
				if (!galleries[linkGallery]) {
					return false;
				}
				tID = galleries[linkGallery][linkID];
			} else {
				tID = parseInt(el.getAttribute("data-pe-target-id"),10);
			}
			if (tID >= 0) {
				open();
				process(tID);
			}
			return false;
		}
		
		function removeRenderer(id) {
			var found = $.inArray(id,rendererList);
			if (found !== false) {
				rendererList.splice(found,1); 
			}
			renderers[id] = undefined;
			delete renderers[id];
		}

		
		function signal(type,id) {
			switch (type) {
			case "loaded":
				loaded++;
				if (loadQueue.length === loaded && overlayActive) {
					render();
				}
				break;
			case "destroy":
				removeRenderer(id);
				break;
			case "locked":
				locked++;
				break;
			case "unlocked":
				locked--;
				break;
			}
		}

		
		function show(id) {
			var renderer = renderers[id];
			var output = renderer.resize(w,h).render();
						
			if (renderer.isGallery) {
				content.append(output);				
			} else {
				output.css("left",offset[direction].from);
				content.append(output);
				if (useTransitions) {
					output.fadeTo(0,1).css("left",offset[direction].to);					
				} else {
					output.css("opacity",0).animate({"left":offset[direction].to,"opacity":1},1000);
				}
			}
			
			if ($.inArray(renderer,displayList) < 0) {
				displayList.push(renderer);				
			}
			
			if (videoResource && !currentGallery) {
				videoIcon.removeClass("peFlareLightboxActive");
				createVideo();
			} else {
				videoIcon[videoResource ? "addClass":"removeClass"]("peFlareLightboxActive");				
			}
			
			if (conf.captions) {
				addCaption(items[currentID].title,items[currentID].description);
			}
			
			
			if (currentGallery && conf.delay > 0) {
				clearTimeout(slideshowTimer);
				slideshowTimer = setTimeout(slideshowNext,conf.delay*1000);
			}
			
		}
		
		function slideshowNext() {
			clearTimeout(slideshowTimer);
			if (locked || videoOverlay.hasClass("peFlareLightboxActive")) {
				slideshowTimer = setTimeout(slideshowNext,500);
			} else {
				next();
			}
		}
		
		function addCaption(title,description) {
			oldCaptions = captionsOverlay.find("> div");
			
			if (useTransitionEnd) {
				oldCaptions.removeClass("peFlareLightboxActive");
			} else {
				oldCaptions.fadeTo(300,0);
			}
			
			if (title || description) {
				title = title ? "<h3>%0</h3>".format(title) : "";
				description = description ? "<p>%0</p>".format(description) : "";				
				captionsOverlay.append('<div><div>%0%1</div></div>'.format(title,description));

			}
			resizeCaptions();
			setTimeout(fadeInCaption,500);

		}
		
		function fadeInCaption() {
			if (oldCaptions) {
				oldCaptions.detach();
				oldCaptions = false;
			}
			
			if (useTransitionEnd) {
				captionsOverlay.find("> div").addClass("peFlareLightboxActive");
			} else {
				captionsOverlay.find("> div").stop().fadeTo(0,0).fadeTo(500,1);
			}
		}

		
		function clearDisplayList() {
			if (!needDisplayListClear) {
				return;
			}
			needDisplayListClear = false;
			var r,el;
			while ((r = displayList.shift())) {
				if (useTransitionEnd) {
					r.render().fadeTo(0,0).css("left",-offset[direction].from).one(useTransitionEnd,r.destroy);					
				} else {
					r.render().css("opacity",1).animate({"left":-offset[direction].from,"opacity":0},1000,null,r.destroy);
				}
				//r.destroy();
			}
			
		}

		
		function render() {
			hideSpinner();
						
			if (rendered) {
				return;
			}
			rendered = true;
			
			var id;
			
			clearDisplayList();
			while ((id = loadQueue.shift()) !== undefined) {
				show(id);
			}
		}
		
		function addItem(item) {
			var gallery = item.gallery || false;
			var id = item.id !== undefined ? item.id : items.length;
			if (gallery) {
				if (galleries[gallery]) {
					galleries[gallery].push(id);
				} else {
					galleries[gallery]= [id];
				}
			}
			items.push(item);
			
		}

		
		function add(target) {
			var id,link = target.attr("href");
			if (link.charAt(0) == "#") {
				link = link.substring(1);
				var gallery = link.substring(0,link.lastIndexOf("-"));
				if (gallery) {
					id  = link.substring(link.lastIndexOf("-")+1);	
				} else {
					gallery = link;
					id = 0;
				}
				if (gallery) {
					target
						.attr("data-pe-flare-id",id)
						.attr("data-pe-flare-gallery",gallery)
						.bind("click",click);
				}
				return;
			}
			id = targets.length;
			var resource = target.attr("href");
			var plugin = target.attr("data-flare-plugin") || "default";
			
			target.attr("data-pe-target-id",targets.length).bind("click",click);
			
			
			var videoInfo;
			videoInfo = $.pixelentity.videoplayer.getInfo(resource,target.attr("data-flare-videoformats"),target.attr("data-flare-videoposter"));
			
			if (videoInfo.video) {
				resource = videoInfo.videoPoster;
			} else {
				videoInfo = $.pixelentity.videoplayer.getInfo(target.attr("data-flare-video"),target.attr("data-flare-videoformats"));				
			}			
			
			var title = target.attr(conf.titleAttr) || "";
			var description = target.attr(conf.descriptionAttr);
			
			
			if (!description) {
				var el = target.find(conf.descriptionElement);
				if (el.length > 0) {
					description = el.html();
					el.empty().detach();
				} else {
					description = "";
				}
			}
						
			var item = {
					id: id,
					plugin: plugin,
					resource: resource || "",
					gallery: target.attr("data-flare-gallery") || false,
					bw: target.attr("data-flare-bw"),
					thumb: target.attr("data-flare-thumb"),
					thumbover: target.attr("data-flare-thumb-over") != "disabled",
					scale: target.attr("data-flare-scale") || "fit",
					title: title,
					description: description,
					target: target
				};
			
			if((title+description).match(/<a/)) {
				item.thumbover = false;
			}

			
			if (videoInfo.video) {
				$.extend(item,videoInfo);
				item.videoWidth = parseInt(target.attr("data-flare-videowidth"),10) || conf.videoWidth;
			}
			
			targets.push(target);
			addItem(item);
		}
		
		function addToBuffer(el) {
			hiddenBuffer.append(el);
		}
		
		$.extend(this, {
			init:init,
			add:add,
			show:show,
			signal:signal,
			register:register,
			addToBuffer:addToBuffer
			// plublic API
			}
		);
		
		
	}
	
	var lb = $.pixelentity.lightbox = new Lightbox();
	
	
	function PeFlareLightbox(target, conf) {
		
		// init function
		function start() {
			lb.init(conf);
			lb.add(target);
		}
		
		$.extend(this, {
			// plublic API
			destroy: function() {
				target.data("peFlareLightbox", null);
				target = undefined;
			}
		});
		
		// initialize
		start();
	}
		
	// jQuery plugin implementation
	$.fn.peFlareLightbox = function(conf) {
		// return existing instance	
		var api = this.data("peFlareLightbox");
		
		if (api) { 
			return api; 
		}
		
		conf = $.extend(true, {}, $.pixelentity.peFlareLightbox.conf, conf);
		
		// install the plugin for each entry in jQuery object
		this.each(function() {
			var el = $(this);
			api = new PeFlareLightbox(el, conf);
			el.data("peFlareLightbox", api); 
		});
		
		return conf.api ? api: this;		 
	};
	
}(jQuery));