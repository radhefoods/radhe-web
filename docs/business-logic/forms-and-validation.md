# Forms and validation

Every form of the shop, with the rules it checks in the browser and the message each rule shows. The checks exist so that a customer sees a problem before a request is sent; they copy the rules of the API and are never stricter. The API validates everything again and has the last word: what it refuses comes back as an error and is shown at the field it names, or as one alert in the form.

## How the forms are built

| Form | Built with | Rules in |
| --- | --- | --- |
| The delivery address (account, checkout, guest checkout) | `react-hook-form` with a `zod` schema through `@hookform/resolvers/zod`; a field is checked when it is left (`mode: "onTouched"`) and again on "Save" | `src/features/checkout/address-schema.ts` |
| Sign-up, sign-in, forgot password, new password, the guest's email address | React state and four small functions; checked on submit | `src/features/auth/validation.ts` |
| The referral code | React state and one function; checked on submit, looked up while typing | `src/lib/referral/referral-code.ts` |
| Every other form (profile, closing the account, cancelling, return, report, review, discount code, coins, the name of a wishlist) | React state with the check written in the component; checked on submit | The component itself |

The sign-in pages validate without `zod` on purpose: the four functions are all they need, and the library would add about 90 KB to each of those pages. The email pattern in `src/features/auth/validation.ts` is the pattern of `zod`'s `z.email()`; `src/features/auth/validation.test.ts` holds the two side by side.

What all forms share:

- A real `form` with `noValidate`, so Enter submits and the shop's messages replace the browser's bubbles. The two search fields and the product filters are the exception: they rely on the browser's own checks ([search.md](../features/search.md), [blog.md](../features/blog.md), [catalogue.md](../features/catalogue.md)).
- A message stands under its field in place of the hint, in red, and is announced when it appears (`role="alert"`); the field carries `aria-invalid` and points to the message with `aria-describedby`.
- In most forms a message disappears as soon as the customer types in the field again; in the profile it stays until the next "Save".
- The submit button shows a spinner and is disabled while the request is on its way (`loading` of `Button`).
- Many limits are also set on the inputs (`maxLength`), so their "too long" messages are rarely seen.

## The text field

`TextField` in `src/components/ui/field.tsx` is the one text input of the shop: a label, the input, and under it either the hint or the error. The text is 16 px, so iOS does not zoom into a field. `PasswordField` (`src/components/ui/password-field.tsx`) is the same with a button that shows or hides the characters.

| `look` | Where | How it looks |
| --- | --- | --- |
| `plain` (the default) | The account, the sign-in pages | The label above a white field of 48 px |
| `float` | The checkout: the guest's email address and the address form | The label rests inside a field of 56 px and rises to its top edge, smaller, as soon as the field has the focus or a value; it is leaf-coloured while the field has the focus. It stays a real `label` of the input. The field keeps an invisible placeholder of one blank, by which the label knows whether the field is empty |

A refused field has a red outline and a pale red ground in both looks.

## Email, password and names

`src/features/auth/validation.ts`. The email address is trimmed and put in lower case before it is checked and before it is sent (`normalizeEmail`).

| Function | Rule | Message key (`auth`) | English message |
| --- | --- | --- | --- |
| `checkEmail` | At most 254 characters and shaped like an address | `emailInvalid` | Please enter a valid email address. |
| `checkPassword` | Not empty | `passwordRequired` | Please enter your password. |
| `checkPassword` | At least 8 characters | `passwordTooShort` | Please use at least 8 characters. |
| `checkPassword` | At most 128 characters | `passwordTooLong` | Please use at most 128 characters. |
| `checkPasswordPresent` | Not empty; at most 128 characters | `passwordRequired`, `passwordTooLong` | As above |
| `checkName` | Not empty after trimming | `nameRequired` | Please fill in this field. |
| `checkName` | At most 80 characters after trimming | `nameTooLong` | Please use at most 80 characters. |

A password may hold any characters, spaces included; no digit or capital is asked for. Whether it is too easy to guess is the API's judgement (`PASSWORD_TOO_WEAK`: "This password is too easy to guess. Please choose another one.").

| Form | Fields and their checks |
| --- | --- |
| Sign-up | First name and last name: `checkName`. Email: `checkEmail`. Password: `checkPassword`. Referral code: below |
| The code of the sign-up | Exactly six digits after spaces are removed: "Please enter the six digits." |
| Sign-in | Email: `checkEmail`. Password: `checkPasswordPresent` (the API knows the password's rules) |
| Forgot password | Email: `checkEmail` |
| New password | Password: `checkPassword`. Repetition: equal to the password, "The passwords do not match." The repetition is a check of the page alone; the API gets one password |
| The guest's email at the checkout | `checkEmail`, with the checkout's own wording "Please enter a valid email address." (`checkout.guest.emailInvalid`) |

## The referral code

`checkReferralCode` in `src/lib/referral/referral-code.ts`.

| Rule | Message |
| --- | --- |
| Empty (the field is optional), or 6 to 12 letters or digits after trimming and capitals | "A referral code has 6 to 12 letters or digits." (`auth.referralInvalid`) |
| Known to the API (`GET /v1/store/referral-codes/{code}`) | "This referral code is not known. Please check it or leave the field empty." (`auth.referralUnknown`) |

## The delivery address

`addressSchema` in `src/features/checkout/address-schema.ts`. Every text is trimmed first. The messages are keys of `address.errors`.

| Field | Rule | Message |
| --- | --- | --- |
| `label` | Optional; at most 30 characters | "This is too long." |
| `firstName`, `lastName` | Required; at most 80 characters | "Please fill in this field." · "This is too long." |
| `company` | Optional; at most 120 characters | "This is too long." |
| `street` | Required; at most 120 characters | "Please fill in this field." · "This is too long." |
| `houseNumber` | Required; at most 20 characters | "Please fill in this field." · "This is too long." |
| `additionalLine` | Optional; at most 120 characters | "This is too long." |
| `postalCode` | Exactly five digits | "Enter a 5-digit postcode." |
| `city` | Required; at most 80 characters | "Please fill in this field." · "This is too long." |
| `phone` | Optional; with country code: `+`, a digit from 1 to 9, then 6 to 14 digits, after spaces, hyphens, brackets, slashes and dots are removed | "Enter the number with country code, for example +49 151 12345678." |
| `isDefault` | A yes or no | – |
| Country | Not a field of the schema: the plain form shows "Germany" read only (at the checkout the heading of the address panel carries "Germany" instead), and `toAddressInput` always sends `countryCode: "DE"` | – |

Examples: the postcode " 60311 " passes (trimmed), "6031" and "6O311" do not. The phone "+49 151 1234-5678" passes and is sent as `+4915112345678`; "0151 12345678" does not, because the country code is missing.

What is sent (`toAddressInput`): empty optional fields as `null`, which clears them at the API; the phone without its spaces and signs. A guest's address (`toGuestAddressInput`) is the same without `label` and `isDefault`.

The form has two modes. `saved` (the address book, a customer at the checkout) has the label, the standard checkbox and "Save address". `order` (a guest at the checkout) has neither and no button: the checkout page asks the form to check itself when "Buy now" is pressed, and the first refused field takes the focus.

## The profile

`DetailsForm` and `CommunicationForm` in `src/components/account/profile-view.tsx`. The messages are borrowed from `address.errors`.

| Field | Rule | Message |
| --- | --- | --- |
| First name, last name | Required; at most 80 characters after trimming | "Please fill in this field." · "This is too long." |
| Phone | Optional; the phone rule of the address | "Enter the number with country code, for example +49 151 12345678." |
| Language of the emails | One of the shop's languages | – |
| WhatsApp number (only with the feature on) | Optional; the phone rule of the address. Empty is sent as `null` | The same |
| Email address | Read only | – |

## Closing the account

`src/components/account/delete-account.tsx`.

| Field | Rule | Message (`profile.delete`) |
| --- | --- | --- |
| Password | Not empty | "Please enter your password." |
| The checkbox | Ticked | "Please tick the box to go on." |

## Orders: cancelling, returning, reporting, reviewing

The five files named in the table are in `src/components/account`.

| Form | Field | Rule | Message |
| --- | --- | --- | --- |
| Cancel an order (`order-detail.tsx`) | Reason | One of five; "I changed my mind" is preselected | – |
| | Text | Optional; at most 1000 characters | – |
| Return request (`return-request.tsx`) | Quantity per pack size | 0 to the number the API calls returnable; at least one row above 0 | "Choose at least one product." |
| | Reason per chosen row | One of six, chosen from a list that starts empty | "Please choose a reason." |
| | Comment per row | Optional; at most 500 characters | – |
| | Comment for the request | Optional; at most 1000 characters | – |
| Problem report (`report-problem-view.tsx`) | Items | Optional; per ticked row 1 to the delivered number | – |
| | Problems | At least one of six | "Please pick at least one problem." |
| | Description | 10 to 2000 characters after trimming | "Please write at least 10 characters." |
| | Photos (`photo-picker.tsx`) | JPEG, PNG or WebP; five at most | "Please choose JPEG, PNG or WebP pictures." · "Up to 5 photos per report." |
| | Wish | One of three; "Refund" is preselected | – |
| Review of an order (`order-review.tsx`) | Stars | One to five | "Please choose a number of stars." |
| | Text | 10 to 2000 characters after trimming | "Please write at least 10 characters." |

The limits of the report and the review are constants (`ISSUE_TEXT_MIN`, `ISSUE_TEXT_MAX`, `ISSUE_PHOTOS_MAX`, `ISSUE_PHOTO_TYPES` in `src/features/issues/issues.ts`; `REVIEW_TEXT_MIN`, `REVIEW_TEXT_MAX` in `src/features/reviews/reviews.ts`). The size of a photo is not checked in the browser.

## The checkout: discount code, coins, the guest's fields, the consent

| Control | Rule in the browser | Message |
| --- | --- | --- |
| Discount code (`src/components/checkout/discount-code.tsx`) | Not empty after trimming ("Apply" is disabled until then); at most 40 characters. Shown in capitals, sent as typed | None of its own: whether a code exists and applies is the API's answer, shown by its reason ("This code does not exist.", "This code has been used up.", …; see [discount-codes.md](../features/discount-codes.md)) |
| Coins to redeem (`src/components/checkout/redeem-coins.tsx`) | A whole number from 1 up. A number above the most allowed is sent and cut down by the API | "Enter a whole number of coins, 1 or more." (`checkout.rewards.invalid`); the API's reasons are in [rewards.md](../features/rewards.md) |
| The guest's email address | `checkEmail` | "Please enter a valid email address." |
| The guest's address | `addressSchema`, in the `order` mode | The messages of the address |
| A customer's address | One saved address must be chosen and the address form closed | "Please choose or add a delivery address." |
| The consent | Ticked | "Please accept the terms to place your order." |

A guest who presses "Buy now" with a refused email address or address also sees "Please fill in the marked fields." above the button, because on a phone the button floats far from the fields. The order of the checks is: the guest's address and email, then the consent. See [checkout.md](../features/checkout.md).

## Other forms

| Form | Rule | Message |
| --- | --- | --- |
| The name of a wishlist (`src/components/wishlist/wishlist-lists.tsx`) | Not empty after trimming; at most 40 characters | "Please give the list a name."; the API's `WISHLIST_NAME_TAKEN` shows as "You already have a list with this name." |
| The news and WhatsApp switches of the profile | None: each switch is stored when it is moved | – |
| Unsubscribing from news | One button, no field ([email-unsubscribe.md](../features/email-unsubscribe.md)) | – |

## How errors of the API are shown

The API answers a refused request with a code ([api/error-handling.md](../api/error-handling.md)). Three things can happen in a form:

| The API answers | The form shows |
| --- | --- |
| `VALIDATION_FAILED` with the names of fields | `fieldProblems` in `src/lib/api/errors.ts` turns the answer into a list by field. A field the form knows gets a message under it and, in the address form, the focus. The message is the form's general one, not the API's English text: "Please check this field." (`auth.fieldInvalid`, `address.errors.invalid`); the sign-in uses its own two messages, the review its two, the referral code "A referral code has 6 to 12 letters or digits." |
| A code the form has a place for | The place: `CUSTOMER_EMAIL_TAKEN` under the email address of the sign-up, `PASSWORD_TOO_WEAK` under the password, `SIGNUP_CODE_INVALID` under the code with the attempts left, `CUSTOMER_CREDENTIALS_INVALID` under the password of the delete panel, `DISCOUNT_NOT_APPLICABLE` and `REWARDS_NOT_APPLICABLE` under their fields with the reason, `WISHLIST_NAME_TAKEN` under the name |
| Anything else, also `VALIDATION_FAILED` for a field the form does not have | One `ErrorAlert` in the form with the sentence of the code from the `errors` texts ("Please check the marked fields." for `VALIDATION_FAILED`); for a fault that is not the customer's, the request id is added for support |

The profile's details form is the exception to the third row: a field the API names and the form does not show (anything but the names and the phone) leaves no message at all.

After a refusal the form keeps what was typed. Secrets are the exception: a refused sign-in empties the password, and so do a password called too weak and a wrong password in the delete panel; a wrong code of the sign-up empties the code.

## The API has the last word

| Rule | Why |
| --- | --- |
| No rule in the browser is stricter than the API's | A value the form refused would be one the API accepts; the customer would be stuck for nothing |
| A rule copied into the browser is a convenience, not a guard | Anyone can send a request without the form; only the API's check counts |
| Amounts, stock, codes, coins, windows and permissions are never checked in the browser | They change on the server; the shop shows what the API says ([prices-and-availability.md](prices-and-availability.md), [cart-and-bill.md](cart-and-bill.md)) |
| When a rule of the API changes, its copy here changes with it | The rules above mirror [customer-auth.md](../reference/backend/customer-auth.md) (section 4) and [store-api.md](../reference/backend/store-api.md) (sections 1 to 3, 12, 21, 23) and [order-reviews.md](../reference/backend/order-reviews.md) |

## Tests

| File | Covers |
| --- | --- |
| `src/features/auth/validation.test.ts` | Email, password and name checks; the email pattern against `zod`'s |
| `src/features/checkout/address-schema.test.ts` | Every rule of the address, and what is sent |
| `src/lib/referral/referral-code.test.ts` | The shape of a referral code and how it is kept |
| `src/features/issues/issues.test.ts` | The sums of the report page |
| `e2e/checkout.spec.ts`, `e2e/account.spec.ts`, `e2e/guest.spec.ts`, `e2e/issues.spec.ts`, `e2e/reviews.spec.ts`, `e2e/referral.spec.ts`, `e2e/rewards.spec.ts` | The forms in the browser, with the messages above |
