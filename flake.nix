{
  description = "tskr dev shell";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        lib = pkgs.lib;
        pname = "taskr";
        version = "0.1.0";
        nodejs = pkgs.nodejs_24;
        pnpm = pkgs.nodePackages.pnpm;
        pnpmVersion = "9.12.0";
        corepackCmd = "${nodejs}/bin/corepack";
        src = lib.cleanSourceWith {
          src = ./.;
          filter = path: type:
            let
              base = builtins.baseNameOf path;
            in
              !(base == ".git"
                || base == ".next"
                || base == ".direnv"
                || base == "node_modules"
                || base == "result");
        };
        pnpmDeps = pkgs.stdenv.mkDerivation {
          pname = "${pname}-pnpm-deps";
          inherit version src;
          nativeBuildInputs = [ nodejs pnpm pkgs.cacert ];
          outputHashMode = "recursive";
          outputHashAlgo = "sha256";
          outputHash = lib.fakeHash; # Replace with the real hash after the first build.
          buildPhase = ''
            export HOME=$TMPDIR
            export XDG_CACHE_HOME=$TMPDIR/xdg-cache
            export XDG_CONFIG_HOME=$TMPDIR/xdg-config
            export COREPACK_ENABLE_STRICT=0
            export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
            export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
            export NODE_EXTRA_CA_CERTS=$SSL_CERT_FILE
            ${corepackCmd} prepare pnpm@${pnpmVersion} --activate
            pnpmBin="$HOME/.local/share/pnpm/.tools/pnpm/${pnpmVersion}/bin/pnpm"
            "$pnpmBin" config set store-dir $out
            "$pnpmBin" fetch --frozen-lockfile
          '';
          installPhase = "true";
        };
        app = pkgs.stdenv.mkDerivation {
          inherit pname version src;
          nativeBuildInputs = [
            nodejs
            pnpm
            pkgs.cacert
            pkgs.python3
            pkgs.pkg-config
          ];
          buildInputs = [
            pkgs.openssl
          ];
          buildPhase = ''
            export HOME=$TMPDIR
            export XDG_CACHE_HOME=$TMPDIR/xdg-cache
            export XDG_CONFIG_HOME=$TMPDIR/xdg-config
            export COREPACK_ENABLE_STRICT=0
            export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
            export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
            export NODE_EXTRA_CA_CERTS=$SSL_CERT_FILE
            export NEXT_TELEMETRY_DISABLED=1
            export DATABASE_URL="file:./dev.db"

            cp -r ${pnpmDeps} $TMPDIR/pnpm-store
            chmod -R +w $TMPDIR/pnpm-store
            ${corepackCmd} prepare pnpm@${pnpmVersion} --activate
            pnpmBin="$HOME/.local/share/pnpm/.tools/pnpm/${pnpmVersion}/bin/pnpm"
            "$pnpmBin" config set store-dir $TMPDIR/pnpm-store

            "$pnpmBin" install --frozen-lockfile --offline
            "$pnpmBin" prisma generate
            "$pnpmBin" run build
          '';
          installPhase = ''
            mkdir -p $out/app
            cp -r .next/standalone/* $out/app/
            mkdir -p $out/app/.next
            cp -r .next/static $out/app/.next/static
            cp -r public $out/app/public
            cp -r prisma $out/app/prisma
            cp prisma.config.ts $out/app/prisma.config.ts
            cp docker-entrypoint.sh $out/app/docker-entrypoint.sh
            chmod +x $out/app/docker-entrypoint.sh

            mkdir -p $out/app/prisma-node_modules/node_modules
            cp -LR node_modules/prisma $out/app/prisma-node_modules/node_modules/
            cp -LR node_modules/@prisma $out/app/prisma-node_modules/node_modules/
          '';
        };
        containerImage = pkgs.dockerTools.buildLayeredImage {
          name = "taskr";
          tag = "nix";
          contents = [
            app
            nodejs
            pkgs.openssl
            pkgs.sqlite
            pkgs.busybox
          ];
          extraCommands = ''
            mkdir -p data
            chmod 755 data
            chown 1001:1001 data

            mkdir -p home/nextjs
            chown 1001:1001 home/nextjs

            mkdir -p etc
            cat > etc/passwd <<'EOF'
nextjs:x:1001:1001:nextjs:/home/nextjs:/sbin/nologin
EOF
            cat > etc/group <<'EOF'
nextjs:x:1001:
EOF
          '';
          config = {
            WorkingDir = "/app";
            Env = [
              "NODE_ENV=production"
              "PORT=3000"
              "DATABASE_URL=file:/data/dev.db"
              "NEXT_TELEMETRY_DISABLED=1"
            ];
            User = "1001:1001";
            ExposedPorts = { "3000/tcp" = { }; };
            Entrypoint = [ "/app/docker-entrypoint.sh" ];
            Cmd = [ "node" "server.js" ];
          };
        };
      in {
        devShells.default = pkgs.mkShell {
          packages = [
            nodejs
            pkgs.corepack
            pnpm
            pkgs.openssl
            pkgs.sqlite
            pkgs.pkg-config
            pkgs.docker
            pkgs.docker-compose
          ];
          shellHook = ''
            export PATH=$PATH:./node_modules/.bin
          '';
        };
        packages = {
          app = app;
          containerImage = containerImage;
          default = containerImage;
        };
      });
}
