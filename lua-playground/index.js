!function (t, e) {
	if ('object' == typeof exports && 'object' == typeof module)
		module.exports = e();
	else if ('function' == typeof define && define.amd)
		define([], e);
	else {
		var i = e();
		for (var o in i)
			('object' == typeof exports ? exports : t)[o] = i[o];
	}
}(self, () => (() => {
	'use strict';
	var t = {
			593: (t, e) => {
				Object.defineProperty(e, '__esModule', { value: !0 }), e.EventEmitter = void 0;
				var i = function () {
					function t() {
						this.listeners = [];
					}
					return Object.defineProperty(t.prototype, 'register', {
						get: function () {
							var t = this.listeners;
							return function (e) {
								return t.push(e), {
									dispose: function () {
										for (var i = 0; i < t.length; i++)
											if (t[i] === e)
												return void t.splice(i, 1);
									}
								};
							};
						},
						enumerable: !1,
						configurable: !0
					}), t.prototype.fire = function (t) {
						for (var e = 0, i = this.listeners; e < i.length; e++)
							(0, i[e])(t);
					}, t;
				}();
				e.EventEmitter = i;
			},
			164: function (t, e, i) {
				var o = this && this.__createBinding || (Object.create ? function (t, e, i, o) {
						void 0 === o && (o = i);
						var r = Object.getOwnPropertyDescriptor(e, i);
						r && !('get' in r ? !e.__esModule : r.writable || r.configurable) || (r = {
							enumerable: !0,
							get: function () {
								return e[i];
							}
						}), Object.defineProperty(t, o, r);
					} : function (t, e, i, o) {
						void 0 === o && (o = i), t[o] = e[i];
					}), r = this && this.__exportStar || function (t, e) {
						for (var i in t)
							'default' === i || Object.prototype.hasOwnProperty.call(e, i) || o(e, t, i);
					};
				Object.defineProperty(e, '__esModule', { value: !0 }), r(i(287), e), r(i(925), e), r(i(918), e), r(i(836), e), r(i(459), e);
			},
			287: (t, e, i) => {
				Object.defineProperty(e, '__esModule', { value: !0 }), e.LineDiscipline = void 0;
				var o = i(918), r = i(925), s = i(593), n = function () {
						function t() {
							this._onWriteToLower = new s.EventEmitter(), this.onWriteToLower = this._onWriteToLower.register, this._onWriteToUpper = new s.EventEmitter(), this.onWriteToUpper = this._onWriteToUpper.register, this._onSignalToUpper = new s.EventEmitter(), this.onSignalToUpper = this._onSignalToUpper.register, this._onFlowActivated = new s.EventEmitter(), this.onFlowActivated = this._onFlowActivated.register, this._onFlowDeactivated = new s.EventEmitter(), this.onFlowDeactivated = this._onFlowDeactivated.register, this.T = r.defaultTermios, this.keyActions = new Array(256).fill('normal'), this.flowActivated = !0, this.column = 0, this.baseColumn = 0, this.vlnext = !1, this.echoprt = !1, this.toLowerBuf = [], this.toUpperBuf = [], this.termios = r.defaultTermios;
						}
						return t.prototype.activateFlow = function () {
							this.flowActivated = !0, this._onFlowActivated.fire();
						}, t.prototype.deactivateFlow = function () {
							this.flowActivated = !1, this._onFlowDeactivated.fire();
						}, Object.defineProperty(t.prototype, 'flow', {
							get: function () {
								return this.flowActivated;
							},
							enumerable: !1,
							configurable: !0
						}), Object.defineProperty(t.prototype, 'termios', {
							get: function () {
								return this.T;
							},
							set: function (t) {
								this.T = t;
								var e = new Array(256).fill('normal');
								t.ICANON_P && (e[t.EOF_V] = 'VEOF', e[t.EOL_V] = 'VEOL', e[t.EOL2_V] = 'VEOL', e[t.ERASE_V] = 'VERASE', e[t.KILL_V] = 'VKILL', t.IEXTEN_P && (e[t.REPRINT_V] = 'VREPRINT', e[t.WERASE_V] = 'VWERASE')), t.IEXTEN_P && (e[t.LNEXT_V] = 'VLNEXT'), t.IXON_P && (e[t.START_V] = 'VSTART', e[t.STOP_V] = 'VSTOP'), t.ISIG_P && (e[t.INTR_V] = 'VINTR', e[t.QUIT_V] = 'VQUIT', e[t.SUSP_V] = 'VSUSP'), e[0] = 'normal', this.keyActions = e, this.T.IXON_P || (this.activateFlow(), this.flushToLower());
							},
							enumerable: !1,
							configurable: !0
						}), t.prototype.clearToLower = function () {
							this.toLowerBuf.length = 0;
						}, t.prototype.flushToLower = function () {
							0 != this.flowActivated && (this._onWriteToLower.fire(this.toLowerBuf), this.clearToLower());
						}, t.prototype.outputToLower = function (t) {
							var e;
							(e = this.toLowerBuf).push.apply(e, t);
						}, t.prototype.clearToUpper = function () {
							this.toUpperBuf.length = 0, this.baseColumn = this.column;
						}, t.prototype.flushToUpper = function () {
							this._onWriteToUpper.fire(this.toUpperBuf), this.clearToUpper();
						}, t.prototype.outputToUpper = function (t) {
							this.toUpperBuf.push(t);
						}, t.prototype.outputToLowerWithPostprocess = function (t) {
							if (this.T.OPOST_P)
								switch (t) {
								case o.BS:
									this.column > 0 && this.column--, this.outputToLower([o.BS]);
									break;
								case o.TAB:
									var e = 8 - this.column % 8;
									this.column += e, this.outputToLower(this.T.TABDLY_XTABS_P ? new Array(e).fill(o.SP) : [o.TAB]);
									break;
								case o.NL:
									this.T.ONLCR_P ? (this.baseColumn = this.column = 0, this.outputToLower([
										o.CR,
										o.NL
									])) : this.T.ONLRET_P ? (this.column = 0, this.outputToLower([o.NL])) : (this.baseColumn = this.column, this.outputToLower([o.NL]));
									break;
								case o.CR:
									this.T.ONOCR_P && 0 == this.column || (this.T.OCRNL_P ? (this.T.ONLRET_P && (this.baseColumn = this.column = 0), this.outputToLower([o.NL])) : (this.baseColumn = this.column = 0, this.outputToLower([o.CR])));
									break;
								default:
									this.T.IUTF8_P && (0, o.isUtf8ContinuationByte)(t) || this.column++, this.outputToLower(this.T.OLCUC_P ? [(0, o.toupper)(t)] : [t]);
								}
							else
								this.outputToLower([t]);
						}, t.prototype.echoToLower = function (t, e) {
							'number' == typeof t && (t = [t]);
							for (var i = 0, r = t; i < r.length; i++) {
								var s = r[i];
								this.T.ECHOCTL_P && (0, o.iscntrl)(s) && s != o.TAB && !e ? (this.outputToLower([
									94,
									64 ^ s
								]), this.column += 2) : this.outputToLowerWithPostprocess(s);
							}
						}, t.prototype.inputFromLowerWithPreprocess = function (t) {
							if (t == o.CR) {
								if (this.T.IGNCR_P)
									return;
								this.T.ICRNL_P && (t = o.NL);
							} else
								t == o.NL && this.T.INLCR_P && (t = o.CR);
							this.T.ICANON_P && t == o.NL ? ((this.T.ECHO_P || this.T.ECHONL_P) && (this.echoToLower(o.NL, !0), this.flushToLower()), this.outputToUpper(o.NL), this.flushToUpper()) : this.T.ECHO_P ? (this.finishECHOPRT(), t == o.NL ? this.echoToLower(o.NL, !0) : this.echoToLower(t), this.flushToLower(), this.outputToUpper(t)) : this.outputToUpper(t);
						}, t.prototype.erase = function (t) {
							if (0 != this.toUpperBuf.length) {
								if ('VKILL' == t) {
									if (!this.T.ECHO_P)
										return void this.clearToUpper();
									if (!this.T.ECHOK_P || !this.T.ECHOKE_P || !this.T.ECHOE_P)
										return this.clearToUpper(), this.finishECHOPRT(), this.echoToLower(this.T.KILL_V), void (this.T.ECHOK_P && this.echoToLower(o.NL, !0));
								}
								for (var e = !1, i = this.toUpperBuf.length - 1; i >= 0; i--) {
									var r = this.toUpperBuf[i];
									if (!this.T.IUTF8_P || !(0, o.isUtf8ContinuationByte)(r)) {
										if ('VWERASE' == t)
											if ((0, o.isalnum)(r) || 95 == r)
												e = !0;
											else if (e)
												break;
										var s = this.toUpperBuf.splice(i);
										if (this.T.ECHO_P)
											if (this.T.ECHOPRT_P)
												this.startECHOPRT(), this.echoToLower(s);
											else if ('VERASE' != t || this.T.ECHOE_P)
												if (r == o.TAB) {
													for (var n = 0, h = !1, a = this.toUpperBuf.length - 1; a >= 0; a--) {
														var f = this.toUpperBuf[a];
														if (f == o.TAB) {
															h = !0;
															break;
														}
														(0, o.iscntrl)(f) ? this.T.ECHOCTL_P && (n += 2) : this.T.IUTF8_P && (0, o.isUtf8ContinuationByte)(f) || n++;
													}
													h || (n += this.baseColumn), n = 8 - n % 8, this.outputToLower(new Array(n).fill(o.BS)), this.column = Math.max(0, this.column - n);
												} else
													(0, o.iscntrl)(r) && this.T.ECHOCTL_P && this.echoToLower([
														o.BS,
														o.SP,
														o.BS
													], !0), (0, o.iscntrl)(r) && !this.T.ECHOCTL_P || this.echoToLower([
														o.BS,
														o.SP,
														o.BS
													], !0);
											else
												this.echoToLower(this.T.ERASE_V);
										if ('VERASE' == t)
											break;
									}
								}
								0 == this.toUpperBuf.length && (this.clearToUpper(), this.T.ECHO_P && this.finishECHOPRT());
							}
						}, t.prototype.startECHOPRT = function () {
							this.echoprt || (this.echoToLower(92, !0), this.echoprt = !0);
						}, t.prototype.finishECHOPRT = function () {
							this.echoprt && (this.echoToLower(47, !0), this.echoprt = !1);
						}, t.prototype.signal = function (t, e) {
							this._onSignalToUpper.fire(t), this.T.NOFLSH_P || (this.clearToLower(), this.clearToUpper()), this.T.IXON_P && this.activateFlow(), this.T.ECHO_P && this.echoToLower(e), this.flushToLower();
						}, t.prototype.checkStartFlow = function () {
							0 == this.flowActivated && this.T.IXON_P && this.T.IXANY_P && (this.activateFlow(), this.flushToLower());
						}, t.prototype.nextLiteral = function () {
							this.vlnext = !0, this.T.ECHO_P && (this.finishECHOPRT(), this.T.ECHOCTL_P && (this.echoToLower([
								94,
								o.BS
							], !0), this.flushToLower()));
						}, t.prototype.reprint = function () {
							this.finishECHOPRT(), this.echoToLower(this.T.REPRINT_V), this.echoToLower(o.NL, !0), this.echoToLower(this.toUpperBuf);
						}, t.prototype.writeFromLower = function (t) {
							for (var e = 0, i = 'string' == typeof t ? (0, o.stringToUtf8Bytes)(t) : t; e < i.length; e++) {
								var r = i[e];
								this.T.ISTRIP_P && (r &= 127), this.T.IUCLC_P && this.T.IEXTEN_P && (r = (0, o.tolower)(r));
								var s = this.vlnext ? 'normal' : this.keyActions[r];
								switch (this.vlnext = !1, s) {
								case 'normal':
									this.checkStartFlow(), this.inputFromLowerWithPreprocess(r);
									break;
								case 'VERASE':
								case 'VWERASE':
								case 'VKILL':
									this.checkStartFlow(), this.erase(s), this.flushToLower();
									break;
								case 'VEOF':
									this.checkStartFlow(), this.flushToUpper();
									break;
								case 'VEOL':
									this.checkStartFlow(), this.T.ECHO_P && (this.echoToLower(r), this.flushToLower()), this.outputToUpper(r), this.flushToUpper();
									break;
								case 'VLNEXT':
									this.checkStartFlow(), this.nextLiteral();
									break;
								case 'VREPRINT':
									this.checkStartFlow(), this.reprint(), this.flushToLower();
									break;
								case 'VSTART':
									this.activateFlow(), this.flushToLower();
									break;
								case 'VSTOP':
									this.deactivateFlow();
									break;
								case 'VINTR':
									this.signal('SIGINT', r);
									break;
								case 'VQUIT':
									this.signal('SIGQUIT', r);
									break;
								case 'VSUSP':
									this.signal('SIGTSTP', r);
								}
							}
							this.T.ICANON_P || this.flushToUpper();
						}, t.prototype.writeFromUpper = function (t) {
							if (0 == this.flowActivated)
								throw 'Do not write anything during flowStatus is stopped';
							for (var e = 0, i = 'string' == typeof t ? (0, o.stringToUtf8Bytes)(t) : t; e < i.length; e++) {
								var r = i[e];
								this.outputToLowerWithPostprocess(r);
							}
							this.flushToLower();
						}, t;
					}();
				e.LineDiscipline = n;
			},
			836: (t, e, i) => {
				Object.defineProperty(e, '__esModule', { value: !0 }), e.openpty = e.Slave = void 0;
				var o = i(593), r = i(287), s = i(918), n = function () {
                                                function t(t, e) {
                                                        var i = this;
                                                        this.ldisc = t, this.slave = e, this.disposables = [], this._onWrite = new o.EventEmitter(), this.onWrite = this._onWrite.register, this.fromLdiscToLowerBuffer = [], this.waitingForLower = !1, this.displayOutput = !0, this._suppressListener = null;
							var r = function () {
								if (i.fromLdiscToLowerBuffer.length >= 1) {
									i.waitingForLower = !0;
									var t = new Uint8Array(i.fromLdiscToLowerBuffer.splice(0, 4096));
									i.fromLdiscToLowerBuffer.length <= 4096 && i.notifyWritable(), i._onWrite.fire([
										t,
										r
									]);
								} else
									i.waitingForLower = !1;
							};
							this.ldisc.onWriteToLower(function (t) {
								var e;
								(e = i.fromLdiscToLowerBuffer).push.apply(e, t), i.waitingForLower || r();
							});
							var s = e.initFromMaster(), n = s.notifyWritable, h = s.notifyResize;
							this.notifyWritable = n, this.notifyResize = h;
						}
                                                return t.prototype.activate = function (t) {
                                                        var e = this;
                                                        this.onWrite(function (i) {
                                                                var o = i[0], r = i[1];
                                                                if (e.displayOutput)
                                                                        return t.write(o, r);
                                                        });
							var i = function (t) {
								return e.ldisc.writeFromLower((0, s.stringToUtf8Bytes)(t));
							};
                                                        this.disposables.push(t.onData(i), t.onBinary(i), t.onResize(function (t) {
                                                                var i = t.cols, o = t.rows;
                                                                return e.notifyResize(o, i);
                                                        }));
                                                }, t.prototype.suppressOutput = function () {
                                                        var t = this;
                                                        this.displayOutput = !1, this._suppressListener || (this._suppressListener = this.onWrite(function (e) {
                                                                var i = e[1];
                                                                return i();
                                                        }));
                                                }, t.prototype.resumeOutput = function () {
                                                        this.displayOutput = !0, this._suppressListener && (this._suppressListener.dispose(), this._suppressListener = null);
                                                }, t.prototype.dispose = function () {
                                                        this.disposables.forEach(function (t) {
                                                                return t.dispose();
                                                        }), this.disposables.length = 0;
						}, t;
					}(), h = function () {
						function t(t) {
							var e = this;
							this.ldisc = t, this._onReadable = new o.EventEmitter(), this.onReadable = this._onReadable.register, this._onWritable = new o.EventEmitter(), this.onWritable = this._onWritable.register, this._onSignal = new o.EventEmitter(), this.onSignal = this._onSignal.register, this.fromLdiscToUpperBuffer = [], this.fromUpperToLdiscBuffer = [], this.winsize = [
								80,
								24
							], this.ldisc.onWriteToUpper(function (t) {
								var i;
								(i = e.fromLdiscToUpperBuffer).push.apply(i, t), e._onReadable.fire();
							}), this.ldisc.onFlowActivated(function () {
								e.fromUpperToLdiscBuffer.length >= 1 && (e.ldisc.writeFromUpper(e.fromUpperToLdiscBuffer), e.fromUpperToLdiscBuffer.length = 0);
							}), this.ldisc.onSignalToUpper(function (t) {
								e._onSignal.fire(t);
							});
						}
						return t.prototype.initFromMaster = function () {
							var t = this;
							return {
								notifyWritable: function () {
									return t._onWritable.fire();
								},
								notifyResize: function (e, i) {
									t.winsize = [
										i,
										e
									], t._onSignal.fire('SIGWINCH');
								}
							};
						}, Object.defineProperty(t.prototype, 'readable', {
							get: function () {
								return this.fromLdiscToUpperBuffer.length >= 1;
							},
							enumerable: !1,
							configurable: !0
						}), t.prototype.read = function (t) {
							var e = void 0 !== t ? Math.min(this.fromLdiscToUpperBuffer.length, t) : this.fromLdiscToUpperBuffer.length;
							return this.fromLdiscToUpperBuffer.splice(0, e);
						}, Object.defineProperty(t.prototype, 'writable', {
							get: function () {
								return this.fromUpperToLdiscBuffer.length <= 4096;
							},
							enumerable: !1,
							configurable: !0
						}), t.prototype.write = function (t) {
							var e, i = 'string' == typeof t ? (0, s.stringToUtf8Bytes)(t) : t;
							(e = this.fromUpperToLdiscBuffer).push.apply(e, i), this.ldisc.flow && (this.ldisc.writeFromUpper(this.fromUpperToLdiscBuffer), this.fromUpperToLdiscBuffer.length = 0);
						}, t.prototype.ioctl = function (t, e) {
							switch (t) {
							case 'TCGETS':
								return this.ldisc.termios.clone();
							case 'TCSETS':
								return void (this.ldisc.termios = e);
							case 'TIOCGWINSZ':
								return this.winsize;
							}
						}, t;
					}();
				e.Slave = h, e.openpty = function () {
					var t = new r.LineDiscipline(), e = new h(t);
					return {
						master: new n(t, e),
						slave: e
					};
				};
			},
			925: (t, e) => {
				Object.defineProperty(e, '__esModule', { value: !0 }), e.dataToTermios = e.termiosToData = e.defaultTermios = e.Termios = e.VEOL2 = e.VLNEXT = e.VWERASE = e.VDISCARD = e.VREPRINT = e.VEOL = e.VSUSP = e.VSTOP = e.VSTART = e.VSWTCH = e.VMIN = e.VTIME = e.VEOF = e.VKILL = e.VERASE = e.VQUIT = e.VINTR = e.IEXTEN = e.ECHOKE = e.ECHOPRT = e.ECHOCTL = e.NOFLSH = e.ECHONL = e.ECHOK = e.ECHOE = e.ECHO = e.ICANON = e.ISIG = e.XTABS = e.TABDLY = e.ONLRET = e.ONOCR = e.OCRNL = e.ONLCR = e.OLCUC = e.OPOST = e.IUTF8 = e.IMAXBEL = e.IXANY = e.IXON = e.IUCLC = e.ICRNL = e.IGNCR = e.INLCR = e.ISTRIP = void 0, e.ISTRIP = 32, e.INLCR = 64, e.IGNCR = 128, e.ICRNL = 256, e.IUCLC = 512, e.IXON = 1024, e.IXANY = 2048, e.IMAXBEL = 8192, e.IUTF8 = 16384, e.OPOST = 1, e.OLCUC = 2, e.ONLCR = 4, e.OCRNL = 8, e.ONOCR = 16, e.ONLRET = 32, e.TABDLY = 6144, e.XTABS = 6144, e.ISIG = 1, e.ICANON = 2, e.ECHO = 8, e.ECHOE = 16, e.ECHOK = 32, e.ECHONL = 64, e.NOFLSH = 128, e.ECHOCTL = 512, e.ECHOPRT = 1024, e.ECHOKE = 2048, e.IEXTEN = 32768, e.VINTR = 0, e.VQUIT = 1, e.VERASE = 2, e.VKILL = 3, e.VEOF = 4, e.VTIME = 5, e.VMIN = 6, e.VSWTCH = 7, e.VSTART = 8, e.VSTOP = 9, e.VSUSP = 10, e.VEOL = 11, e.VREPRINT = 12, e.VDISCARD = 13, e.VWERASE = 14, e.VLNEXT = 15, e.VEOL2 = 16;
				var i = function () {
					function t(t, i, o, r, s) {
						this.iflag = t, this.oflag = i, this.cflag = o, this.lflag = r, this.cc = s, this.ISTRIP_P = 0 != (this.iflag & e.ISTRIP), this.INLCR_P = 0 != (this.iflag & e.INLCR), this.IGNCR_P = 0 != (this.iflag & e.IGNCR), this.ICRNL_P = 0 != (this.iflag & e.ICRNL), this.IUCLC_P = 0 != (this.iflag & e.IUCLC), this.IXON_P = 0 != (this.iflag & e.IXON), this.IXANY_P = 0 != (this.iflag & e.IXANY), this.IUTF8_P = 0 != (this.iflag & e.IUTF8), this.OPOST_P = 0 != (this.oflag & e.OPOST), this.OLCUC_P = 0 != (this.oflag & e.OLCUC), this.ONLCR_P = 0 != (this.oflag & e.ONLCR), this.OCRNL_P = 0 != (this.oflag & e.OCRNL), this.ONOCR_P = 0 != (this.oflag & e.ONOCR), this.ONLRET_P = 0 != (this.oflag & e.ONLRET), this.TABDLY_XTABS_P = (this.oflag & e.TABDLY) == e.XTABS, this.ISIG_P = 0 != (this.lflag & e.ISIG), this.ICANON_P = 0 != (this.lflag & e.ICANON), this.ECHO_P = 0 != (this.lflag & e.ECHO), this.ECHOE_P = 0 != (this.lflag & e.ECHOE), this.ECHOK_P = 0 != (this.lflag & e.ECHOK), this.ECHONL_P = 0 != (this.lflag & e.ECHONL), this.NOFLSH_P = 0 != (this.lflag & e.NOFLSH), this.ECHOCTL_P = 0 != (this.lflag & e.ECHOCTL), this.ECHOPRT_P = 0 != (this.lflag & e.ECHOPRT), this.ECHOKE_P = 0 != (this.lflag & e.ECHOKE), this.IEXTEN_P = 0 != (this.lflag & e.IEXTEN), this.INTR_V = this.cc[e.VINTR], this.QUIT_V = this.cc[e.VQUIT], this.ERASE_V = this.cc[e.VERASE], this.KILL_V = this.cc[e.VKILL], this.EOF_V = this.cc[e.VEOF], this.TIME_V = this.cc[e.VTIME], this.MIN_V = this.cc[e.VMIN], this.SWTCH_V = this.cc[e.VSWTCH], this.START_V = this.cc[e.VSTART], this.STOP_V = this.cc[e.VSTOP], this.SUSP_V = this.cc[e.VSUSP], this.EOL_V = this.cc[e.VEOL], this.REPRINT_V = this.cc[e.VREPRINT], this.DISCARD_V = this.cc[e.VDISCARD], this.WERASE_V = this.cc[e.VWERASE], this.LNEXT_V = this.cc[e.VLNEXT], this.EOL2_V = this.cc[e.VEOL2];
					}
					return t.prototype.clone = function () {
						return new t(this.iflag, this.oflag, this.cflag, this.lflag, this.cc.concat());
					}, t;
				}();
				e.Termios = i, e.defaultTermios = new i(e.ICRNL | e.IXON | e.IMAXBEL | e.IUTF8, e.OPOST | e.ONLCR, 191, e.ISIG | e.ICANON | e.ECHO | e.ECHOE | e.ECHOK | e.ECHOCTL | e.ECHOKE | e.IEXTEN, [
					3,
					28,
					127,
					21,
					4,
					0,
					1,
					0,
					17,
					19,
					26,
					0,
					18,
					15,
					23,
					22,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0
				]), e.termiosToData = function (t) {
					for (var e = [
								t.iflag,
								t.oflag,
								t.cflag,
								t.lflag
							], i = 0, o = 8, r = 0; r < t.cc.length; r++)
						i |= t.cc[r] << o, 32 == (o += 8) && (e.push(i), i = 0, o = 0);
					return e.push(i), e;
				}, e.dataToTermios = function (t) {
					for (var e = [], o = 4, r = t[o++], s = 8, n = 0; n < 32; n++)
						e.push(r >> s & 255), (s += 8) >= 32 && (r = t[o++], s = 0);
					return new i(t[0], t[1], t[2], t[3], e);
				};
			},
			459: (t, e, i) => {
				Object.defineProperty(e, '__esModule', { value: !0 }), e.TtyServer = void 0;
				var o = i(925), r = function () {
						function t(t) {
							var e = this;
							this.slave = t, this.shared = new SharedArrayBuffer(4096), this.streamCtrl = new Int32Array(this.shared, 0, 1), this.streamData = new Int32Array(this.shared, 4), this.state = 'idle', this.timeoutHandler = null, this.fromWorkerBuf = [], this.toWorkerBuf = [], this.stop_ = null, t.onWritable(function () {
								e.fromWorkerBuf.length >= 1 && e.feedFromWorker();
							}), t.onReadable(function () {
								var i;
								switch ((i = e.toWorkerBuf).push.apply(i, t.read()), e.state) {
								case 'poll':
									e.waitForReadable(0);
									break;
								case 'input':
									e.feedToWorker(e.toWorkerBuf.length);
								}
							}), t.onSignal(function (t) {
								console.info('A signal '.concat(t, ' is currently ignored'));
							});
						}
						return t.prototype.ack = function () {
							Atomics.store(this.streamCtrl, 0, 1), Atomics.notify(this.streamCtrl, 0), this.state = 'idle';
						}, t.prototype.feedToWorker = function (t) {
							if ('input' != this.state)
								throw 'worker does not wait for input';
							t > this.streamData.length - 1 && (t = this.streamData.length - 1);
                                                       var e = this.toWorkerBuf.splice(0, t);
                                                       // try {
                                                       //         var hex = Array.from(e).map(function(x){return x.toString(16).padStart(2,'0');}).join(' ');
                                                       //         console.log('feedToWorker:', hex);
                                                       // } catch (err) {}
                                                       this.streamData[0] = e.length, this.streamData.set(e, 1), this.ack();
						}, t.prototype.feedFromWorker = function () {
							if (0 == this.fromWorkerBuf.length)
								throw 'worker does not wait for output';
							this.slave.writable && (this.ack(), this.slave.write(this.fromWorkerBuf.splice(0)));
						}, t.prototype.waitForReadable = function (t) {
							var e = this;
							if ('poll' != this.state)
								throw 'worker does not wait for poll';
							this.timeoutHandler && (clearTimeout(this.timeoutHandler), this.timeoutHandler = null), this.toWorkerBuf.length > 0 ? (this.streamData[0] = 1, this.ack()) : t < 0 || (t > 0 ? this.timeoutHandler = setTimeout(function () {
								return e.waitForReadable(0);
							}, 1000 * t) : (this.streamData[0] = 2, this.ack()));
						}, t.prototype.start = function (t, e) {
							var i = this;
							this.stop();
							var r = !1;
							this.stop_ = function () {
								return r = !0;
							}, t.onmessage = function (t) {
								var s, n = t.data;
								if ('object' == typeof n && n.ttyRequestType) {
									if (r)
										return;
									var h = n;
									switch (h.ttyRequestType) {
									case 'read':
										i.state = 'input', i.toWorkerBuf.length >= 1 && i.feedToWorker(h.length);
										break;
									case 'write':
										(s = i.fromWorkerBuf).push.apply(s, h.buf), i.feedFromWorker();
										break;
									case 'poll':
										i.state = 'poll', i.waitForReadable(h.timeout);
										break;
									case 'tcgets':
										i.streamData.set((0, o.termiosToData)(i.slave.ioctl('TCGETS'))), i.ack();
										break;
									case 'tcsets':
										i.slave.ioctl('TCSETS', (0, o.dataToTermios)(h.data)), i.ack();
										break;
									case 'tiocgwinsz':
										var a = i.slave.ioctl('TIOCGWINSZ'), f = a[0], l = a[1];
										i.streamData[0] = f, i.streamData[1] = l, i.ack();
									}
								} else
									e && e(t);
							}, t.postMessage(this.shared);
						}, t.prototype.stop = function () {
							this.stop_ && this.stop_();
						}, t;
					}();
				e.TtyServer = r;
			},
			918: (t, e) => {
				Object.defineProperty(e, '__esModule', { value: !0 }), e.stringToUtf8Bytes = e.utf8BytesToString = e.toupper = e.tolower = e.isUtf8ContinuationByte = e.iscntrl = e.isalnum = e.SP = e.CR = e.NL = e.TAB = e.BS = void 0, e.BS = 8, e.TAB = 9, e.NL = 10, e.CR = 13, e.SP = 32, e.isalnum = function (t) {
					return 48 <= t && t <= 57 || 65 <= t && t <= 90 || 95 == t || 97 <= t && t <= 122;
				}, e.iscntrl = function (t) {
					return 0 <= t && t <= 31 && 9 != t || 127 == t;
				}, e.isUtf8ContinuationByte = function (t) {
					return 128 == (192 & t);
				}, e.tolower = function (t) {
					return 65 <= t && t <= 90 ? t + 32 : t;
				}, e.toupper = function (t) {
					return 97 <= t && t <= 122 ? t - 32 : t;
				}, e.utf8BytesToString = function (t) {
					for (var e = '', i = 0; i < t.length;) {
						var o = t[i], r = void 0;
						if (o < 128)
							r = o;
						else if (192 == (224 & o)) {
							if (t.length <= i + 1)
								break;
							r = (31 & o) << 6, r |= 63 & t[++i];
						} else if (224 == (240 & o)) {
							if (t.length <= i + 2)
								break;
							r = (15 & o) << 12, r |= (63 & t[++i]) << 6, r |= 63 & t[++i];
						} else if (240 == (248 & o)) {
							if (t.length <= i + 3)
								break;
							r = (3 & o) << 18, r |= (63 & t[++i]) << 12, r |= (63 & t[++i]) << 6, r |= 63 & t[++i];
						} else
							r = 65534;
						i++, e += String.fromCodePoint(r);
					}
					return [
						e,
						t.slice(i)
					];
				}, e.stringToUtf8Bytes = function (t) {
					for (var e = [], i = 0; i < t.length;) {
						var o = t.codePointAt(i);
						o < 128 ? e.push(o) : o < 2048 ? (e.push(192 | o >> 6), e.push(128 | 63 & o)) : o < 65536 ? (e.push(224 | o >> 12), e.push(128 | o >> 6 & 63), e.push(128 | 63 & o)) : (e.push(240 | o >> 18), e.push(128 | o >> 12 & 63), e.push(128 | o >> 6 & 63), e.push(128 | 63 & o)), i += o >= 65536 ? 2 : 1;
					}
					return e;
				};
			}
		}, e = {};
	return function i(o) {
		var r = e[o];
		if (void 0 !== r)
			return r.exports;
		var s = e[o] = { exports: {} };
		return t[o].call(s.exports, s, s.exports, i), s.exports;
	}(164);
})());	//# sourceMappingURL=index.js.map
