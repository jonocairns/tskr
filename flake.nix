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
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            corepack
            pnpm
            openssl
            sqlite
            pkg-config
            docker
            docker-compose
          ];
          shellHook = ''
            export PATH=$PATH:./node_modules/.bin
          '';
        };
      });
}
