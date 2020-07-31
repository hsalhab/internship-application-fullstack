addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const VARIANTS_URL = "https://cfw-takehome.developers.workers.dev/api/variants"
const DOMAIN = "ab-muffin-testing.hsalhab.workers.dev"

/**
* Reroute traffic to one of two variants with a 50% chance
* @param {Request} request
*/
async function handleRequest(request) {
  try {
    // Find this visitor's variance or determine they are new
    const cookie = getVariantCookie(request) || ""

    let response = await fetch(VARIANTS_URL)
    .then(response => {
      return response.json();
    })
    .then(variants => {
      // Check if it's a new visitor
      if (cookie === "") {
        // Math.round will return 0 for < 0.5, or 1 for >= 0.5, so it's ~50% chance
        const randomIdx = Math.round(Math.random())
        const randomVariant = variants["variants"][randomIdx]
        // fetch the random variant, add a cookie to the response so we show
        // the user the same variant next time
        return fetch(randomVariant).then(response => {
          return addVariantCookie(response, randomIdx)
        })
      } else {
        // find the variant we usually show this user using their cookie then fetch it
        const idx = parseInt(cookie.split("=")[1])
        const variant = variants["variants"][idx]
        return fetch(variant)
      }
    })
    .then(response => {
      // Some HTMLRewriter stuff
      return new HTMLRewriter().on('*', new ElementHandler()).transform(response)
    })
    .catch(err => {
      return new Response(err.stack)
    });

    return response
  } catch (err) {
    return new Response(err.stack)
  }
}

/**
* Adds a cookie to the response's headers
* Does not use Javascript's document.cookie to mitigate
* XSS attacks
* @param {Responst} response
* @param {Int} variant
*/
function addVariantCookie(response, variant) {
  response = new Response(response.body, response)
  response.headers.append(
    'Set-Cookie', "variant=" + variant.toString().trim() + "; Max-Age=31536000"
  )
  return response
}

/**
* Finds the variant cookie or returns null otherwise
* @param {Request} request
*/
function getVariantCookie(request) {
  const cookies = request.headers.get('Cookie')
  if (cookies == null) {
    return null
  }
  return cookies.split("; ").filter(cookie => cookie.startsWith("variant="))[0]
}

class ElementHandler {
  element(element) {
    if (element.tagName === "p") {
      element.setInnerContent("HTMLRewriter is super cool!")
    } else if (element.tagName === "a") {
      element.setInnerContent("Check out my resume")
      element.setAttribute("href", "https://drive.google.com/file/d/1SkdpwC0YbQShncz9MdW_8S18jPOlkA_u/view")
    } else if (element.tagName === "title") {
      element.setInnerContent("A/B Muffin Testing")
    }
  }

  text(text) {
    if (text.text.trim() === "Variant 1") {
      text.replace("My Custom Variant #1")
    } else if (text.text.trim() === "Variant 2") {
      text.replace("My Custom Variant #2")
    }
  }
}
