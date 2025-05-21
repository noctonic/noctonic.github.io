FROM alpine:latest

RUN apk update && \
    apk add --no-cache lua

COPY lua-libs/ /usr/local/share/lua/5.4/

RUN ln -s "$(which lua5.4)" /usr/bin/lua

CMD ["/bin/sh"]
