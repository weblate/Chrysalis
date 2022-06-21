How to release Chrysalis
========================

This is a work in progress document that explains the general steps of cutting a
Chrysalis release. All of these steps are automated by the scripts in
`tools/release/`, but for clarity, the process is explained here step by step,
too.

First and foremost, we need to update the version in
[package.json](../package.json). If it's a bugfix release, bump the last number.
If it has considerable amount of new features, bump the middle one and zero the
last. Until we're in beta, we're keeping the major version at zero.

Once the version is bumped, make sure that the firmware files shipped with
Chrysalis are up to date. Hop over to the
[Chrysalis-Firmware-Bundle][repo:bundle] repository, and make sure everything is
up to date there. If everything is up to date, bump the version therein to be
the same as Chrysalis's version, finalise the NEWS, commit the results, and wait
for the CI to finish, then download the tarball with the compiled firmware,
refresh the firmware files and the firmware changelog in Chrysalis based on
that, and commit it.

 [repo:bundle]: https://github.com/keyboardio/Chrysalis-Firmware-Bundle

With the version bumped and firmware files updated, it is time to update
[NEWS.md](../NEWS.md) with user-visible or otherwise important changes since the
last release. Following the practice in earlier versions is the recommended way
to do that. It is important to keep in mind that the NEWS file is aimed at end
users, it must not be a filtered copy of the git log, but something a bit more
elaborate, and perhaps considerably less technical in nature.

Once these are done, we can commit them together, and tag the release as
`v0.x.y`.

Before pushing it to GitHub, we now need to make a new draft release, so head
over to GitHub, cut a draft release (setting the tag to the one we have locally,
but which we haven't pushed yet), filling out the description based on
`NEWS.md`. Keep it as a draft for now.

When we're done with that, push our commits and the new tag, and wait for the CI
to finish. It will attach the build artifacts to the draft release. Once that is
done, we're ready to publish the draft.

Immediately after, update `package.json`, setting the version to a snapshot
version, like "0.9.1-snapshot", commit, and push, the automation will take care
of the rest.
