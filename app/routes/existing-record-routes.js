const faker = require('faker')
const path = require('path')
const moment = require('moment')
const filters = require('./../filters.js')()
const _ = require('lodash')
const utils = require('./route-utils')
const libUtils = require('./../../lib/utils')


module.exports = router => {
  // Set up data when viewing a record
  router.get('/record/:uuid', function (req, res) {
    const data = req.session.data

    utils.deleteTempData(data)
    const records = req.session.data.records
    const record = records.find(record => record.id == req.params.uuid)
    if (!record){
      res.redirect('/records')
    }
    // Save record to session to be used by views
    req.session.data.record = record

    // Redirect to task list journey if still a draft
    if (record.status == 'Draft'){
      // req.flash('success', 'Restoring saved draft')
      res.redirect('/new-record/overview')
    }
    // Only submitted records
    else {
      res.locals.record = record
      res.render('record')
    }
  })

  // Manually advance an application from pending to trn received
  router.get('/record/:uuid/trn', (req, res) => {
    const data = req.session.data
    const newRecord = data.record
    // Update failed or no data
    if (!newRecord){
      res.redirect('/record/:uuid')
    }
    else {
      if (newRecord.status == 'Pending TRN'){
        newRecord.status = 'TRN received'
        newRecord.trn = faker.random.number({
          'min': 1000000,
          'max': 9999999
        })
        utils.deleteTempData(data)
        utils.updateRecord(data, newRecord, "TRN received")
      }
      res.redirect(`/record/${req.params.uuid}`)
    }
  })

  // Manually advance an application from Pending QTS to QTS awarded
  router.get('/record/:uuid/qts', (req, res) => {
    const data = req.session.data
    const newRecord = data.record
    // Update failed or no data
    if (!newRecord){
      res.redirect('/record/:uuid')
    }
    else {
      if (newRecord.status == 'QTS recommended' || newRecord.status == 'TRN received'){
        newRecord.status = 'QTS awarded'
        _.set(newRecord, 'programmeDetails.endDate', (new Date()))
        _.set(newRecord, 'qtsDetails.qtsDetails.standardsAssessedOutcome', "Passed")
        utils.deleteTempData(data)
        utils.addEvent(newRecord, "Trainee recommended for QTS")
        utils.updateRecord(data, newRecord, "QTS awarded")
      }
      res.redirect(`/record/${req.params.uuid}`)
    }
  })

  // QTS outcome passed or not passed?
  router.post('/record/:uuid/qts/outcome', (req, res) => {
    const data = req.session.data
    if (_.get(data, "record.qtsDetails.standardsAssessedOutcome") == 'Not passed'){
      res.redirect(`/record/${req.params.uuid}/qts/not-passed/reason`)
    }
    else {
      res.redirect(`/record/${req.params.uuid}/qts/passed/confirm`)
    }
  })

  // Copy qts (passed) data back to real record
  router.post('/record/:uuid/qts/passed/confirm', (req, res) => {
    const data = req.session.data
    const newRecord = data.record
    // Update failed or no data
    if (!newRecord){
      res.redirect('/record/:uuid')
    }
    else {
      newRecord.status = 'QTS recommended'
      newRecord.qtsRecommendedDate = new Date()
      utils.deleteTempData(data)
      utils.updateRecord(data, newRecord, "Trainee recommended for QTS")
      // req.flash('success', 'Trainee recommended for QTS')
      res.redirect(`/record/${req.params.uuid}/qts/passed/recommended`)
    }
  })

  // // Cature QTS reasons for not passing and confirm
  // router.post('/record/:uuid/qts/not-passed/assessment-not-passed', (req, res) => {
  //   const data = req.session.data
  //   const newRecord = data.record

  //   // Update failed or no data
  //   if (!newRecord){
  //     res.redirect('/record/:uuid')
  //   }
  //   else {
  //     res.redirect('/record/' + req.params.uuid + '/qts/not-passed/confirm')
  //   }
  // })

  // Copy qts (not passed data) back to real record
  router.post('/record/:uuid/qts/not-passed/update', (req, res) => {
    const data = req.session.data
    const newRecord = data.record
    // Update failed or no data
    if (!newRecord){
      res.redirect('/record/:uuid')
    }
    else {
      // newRecord.status = 'TRN received' //status stays as it is?
      newRecord.qtsNotPassedOutcomeDate = new Date()
      utils.deleteTempData(data)
      utils.updateRecord(data, newRecord, "Trainee did not pass their QTS")
      res.redirect(`/record/${req.params.uuid}/qts/not-passed/not-recommended`)
    }
  })

  // Convert radio choices to real datesso 
  router.post('/record/:uuid/defer', (req, res) => {
    const data = req.session.data
    const newRecord = data.record

    // Update failed or no data
    if (!newRecord){
      res.redirect('/record/:uuid')
    }
    else {
      let radioChoice = newRecord.deferredDateRadio
      if (radioChoice == "Today") {
        newRecord.deferredDate = filters.toDateArray(filters.today())
      } 
      if (radioChoice == "Yesterday") {
        newRecord.deferredDate = filters.toDateArray(moment().subtract(1, "days"))
      } 
      res.redirect(`/record/${req.params.uuid}/defer/confirm`)
    }
  })

  // Copy defer data back to real record
  router.post('/record/:uuid/defer/update', (req, res) => {
    const data = req.session.data
    const newRecord = data.record

    // Update failed or no data
    if (!newRecord){
      res.redirect('/record/:uuid')
    }
    else {
      newRecord.previousStatus = newRecord.status
      newRecord.status = 'Deferred'
      delete newRecord.deferredDateRadio
      utils.deleteTempData(data)
      utils.updateRecord(data, newRecord, "Trainee deferred")
      req.flash('success', 'Trainee deferred')
      res.redirect(`/record/${req.params.uuid}`)
    }
  })

  // Convert radio choices to real dates
  router.post('/record/:uuid/reinstate', (req, res) => {
    const data = req.session.data
    const newRecord = data.record

    // Update failed or no data
    if (!newRecord){
      res.redirect(`/record/${req.params.uuid}`)
    }
    else {
      let radioChoice = newRecord.reinstateDateRadio
      if (radioChoice == "Today") {
        newRecord.reinstateDate = filters.toDateArray(filters.today())
      }
      if (radioChoice == "Yesterday") {
        newRecord.reinstateDate = filters.toDateArray(moment().subtract(1, "days"))
      } 
      res.redirect(`/record/${req.params.uuid}/reinstate/confirm`)
    }
  })

  // Copy reinstate data back to real record
  router.post('/record/:uuid/reinstate/update', (req, res) => {
    const data = req.session.data
    const newRecord = data.record
    // Update failed or no data
    if (!newRecord){
      res.redirect('/record/:uuid')
    }
    else {
      newRecord.status = newRecord.previousStatus || 'TRN received'
      delete newRecord.previousStatus
      utils.deleteTempData(data)
      utils.updateRecord(data, newRecord, "Trainee reinstated")
      req.flash('success', 'Trainee reinstated')
      res.redirect(`/record/${req.params.uuid}`)
    }
  })



  // Copy withdraw data back to real record
  router.post('/record/:uuid/withdraw/update', (req, res) => {
    const data = req.session.data
    const newRecord = data.record

    // Update failed or no data
    if (!newRecord){
      res.redirect('/record/:uuid')
    }
    else {
      newRecord.previousStatus = newRecord.status
      newRecord.status = 'Withdrawn'
      delete newRecord.withdrawDateRadio
      if (newRecord.withdrawalReason != "For another reason") {
        delete newRecord.withdrawalReasonOther
      }
      utils.deleteTempData(data)
      utils.updateRecord(data, newRecord, "Trainee withdrawn")
      req.flash('success', 'Trainee withdrawn')
      res.redirect('/record/' + req.params.uuid)
    }
  })

  // Get dates for withdraw flow
  router.post('/record/:uuid/withdraw', (req, res) => {
    const data = req.session.data
    const newRecord = data.record

    // Update failed or no data
    if (!newRecord){
      res.redirect('/record/:uuid')
    }
    else {
      let radioChoice = newRecord.withdrawalDateRadio
      if (radioChoice == "Today") {
        newRecord.withdrawalDate = filters.toDateArray(filters.today())
      } 
      if (radioChoice == "Yesterday") {
        newRecord.withdrawalDate = filters.toDateArray(moment().subtract(1, "days"))
      } 
      res.redirect('/record/' + req.params.uuid + '/withdraw/confirm')
    }
  })

  // Copy temp record back to real record
  router.post(['/record/:uuid/:page/update', '/record/:uuid/update'], (req, res) => {
    const data = req.session.data
    const newRecord = data.record
    // Update failed or no data
    if (!newRecord){
      res.redirect('/record/:uuid')
    }
    else {
      utils.deleteTempData(data)
      utils.updateRecord(data, newRecord)
      req.flash('success', 'Trainee record updated')

      if (req.params.page && req.params.page != 'programme-details' && req.params.page != 'trainee-id'){
        res.redirect(`/record/${req.params.uuid}/details-and-education`)
      }
      else {
        res.redirect(`/record/${req.params.uuid}`)
      }
    }
  })

  // Get timeline items and pass to view
  router.get('/record/:uuid/timeline', (req, res) => {
    const data = req.session.data
    const record = data.record
    if (!record){
      res.redirect('/record/:uuid')
    }
    let timeline = utils.getTimeline(record)
    console.log({timeline})
    res.render(`record/timeline`, {timeline})
  })

  // Existing record pages
  router.get('/record/:uuid/:page*', function (req, res, next) {
    let records = req.session.data.records
    const referrer = req.query.referrer
    res.locals.referrer = referrer
    const record = records.find(record => record.id == req.params.uuid)
    if (!record){
      res.redirect('/records')
    }
    else {
      // Use our own render as some templates live at /index.html
      utils.render(path.join('record', req.params.page, req.params[0]), res, next)
      // res.render(path.join('record', req.params.page, req.params[0]))
    }
  })


}
