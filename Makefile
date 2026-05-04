.PHONY: test zip clean release help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

test: ## Run tests (zero dependencies, uses node:test)
	node --test test/*.test.js

zip: ## Package extension into dist/arcsider.zip
	@mkdir -p dist
	@rm -f dist/arcsider.zip
	zip -r dist/arcsider.zip manifest.json background.js sidepanel.html sidepanel.js sidepanel.css lib.js assets/icons/

release: ## Bump version, tag, and push (usage: make release VERSION=1.1.0)
	@test -n "$(VERSION)" || (echo "Usage: make release VERSION=x.y.z" && exit 1)
	@node -e "const f='manifest.json';const m=JSON.parse(require('fs').readFileSync(f));m.version='$(VERSION)';require('fs').writeFileSync(f,JSON.stringify(m,null,2)+'\n')"
	@node -e "const f='package.json';const m=JSON.parse(require('fs').readFileSync(f));m.version='$(VERSION)';require('fs').writeFileSync(f,JSON.stringify(m,null,2)+'\n')"
	git add manifest.json package.json
	git commit -s -m "release v$(VERSION)"
	git tag "v$(VERSION)"
	git push origin main --tags

clean: ## Remove build artifacts
	rm -rf dist
