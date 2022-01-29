// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2021 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import Container from "@mui/material/Container";
import React, { useEffect, useReducer, useState } from "react";
import * as api from "./api";
import MoonfireMenu from "./AppMenu";
import Login from "./Login";
import { useSnackbars } from "./snackbars";
import { Camera, Session } from "./types";
import ListActivity from "./List";
import AppBar from "@mui/material/AppBar";
import {BrowserRouter, Routes, Route, Link} from "react-router-dom";
import LiveActivity, { MultiviewChooser } from "./Live";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListIcon from "@mui/icons-material/List";
import Videocam from "@mui/icons-material/Videocam";
import ListItemIcon from "@mui/material/ListItemIcon";
import FilterList from "@mui/icons-material/FilterList";
import IconButton from "@mui/material/IconButton";

export type LoginState =
  | "unknown"
  | "logged-in"
  | "not-logged-in"
  | "server-requires-login"
  | "user-requested-login";

type Activity = "list" | "live";

function App() {
  const [showMenu, toggleShowMenu] = useReducer((m: boolean) => !m, false);
  const [showListSelectors, toggleShowListSelectors] = useReducer(
    (m: boolean) => !m,
    true
  );
  const [activity, setActivity] = useState<Activity>("list");
  const [multiviewLayoutIndex, setMultiviewLayoutIndex] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [timeZoneName, setTimeZoneName] = useState<string | null>(null);
  const [fetchSeq, setFetchSeq] = useState(0);
  const [loginState, setLoginState] = useState<LoginState>("unknown");
  const [error, setError] = useState<api.FetchError | null>(null);
  const needNewFetch = () => setFetchSeq((seq) => seq + 1);
  const snackbars = useSnackbars();

  const clickActivity = (activity: Activity) => {
    toggleShowMenu();
    setActivity(activity);
  };

  const onLoginSuccess = () => {
    setLoginState("logged-in");
    needNewFetch();
  };

  const logout = async () => {
    const resp = await api.logout(
      {
        csrf: session!.csrf,
      },
      {}
    );
    switch (resp.status) {
      case "aborted":
        break;
      case "error":
        snackbars.enqueue({
          message: "Logout failed: " + resp.message,
        });
        break;
      case "success":
        setSession(null);
        needNewFetch();
        break;
    }
  };

  function fetchedCameras(cameras: Camera[] | null) {
    if (cameras !== null && cameras.length >0) {
      return (
        <>
          <Route path="" element={ <ListActivity cameras={cameras}
                                                 showSelectors={showListSelectors}
                                                 timeZoneName={timeZoneName!}
          />} />
          <Route path="live" element={<LiveActivity cameras={cameras} layoutIndex={multiviewLayoutIndex} />} />
        </>
      );
    }
  }

  useEffect(() => {
    const abort = new AbortController();
    const doFetch = async (signal: AbortSignal) => {
      const resp = await api.toplevel({ signal });
      switch (resp.status) {
        case "aborted":
          break;
        case "error":
          if (resp.httpStatus === 401) {
            setLoginState("server-requires-login");
            return;
          }
          setError(resp);
          break;
        case "success":
          setError(null);
          setLoginState(
            resp.response.user?.session === undefined
              ? "not-logged-in"
              : "logged-in"
          );
          setSession(resp.response.user?.session || null);
          setCameras(resp.response.cameras);
          setTimeZoneName(resp.response.timeZoneName);
      }
    };
    doFetch(abort.signal);
    return () => {
      abort.abort();
    };
  }, [fetchSeq]);
  let activityMenu = null;
  if (error === null && cameras !== null && cameras.length > 0) {
    switch (activity) {
      case "list":
        activityMenu = (
          <IconButton
            aria-label="selectors"
            onClick={toggleShowListSelectors}
            color="inherit"
            size="small"
          >
            <FilterList />
          </IconButton>
        );
        break;
      case "live":
        activityMenu = (
          <MultiviewChooser
            layoutIndex={multiviewLayoutIndex}
            onChoice={setMultiviewLayoutIndex}
          />
        );
        break;
    }
  }
  return (
    <BrowserRouter>
      <AppBar position="static">
        <MoonfireMenu
          loginState={loginState}
          setSession={setSession}
          requestLogin={() => {
            setLoginState("user-requested-login");
          }}
          logout={logout}
          menuClick={toggleShowMenu}
          activityMenuPart={activityMenu}
        />
      </AppBar>
      <Drawer
        variant="temporary"
        open={showMenu}
        onClose={toggleShowMenu}
        ModalProps={{
          keepMounted: true,
        }}
      >
        <List>
          <ListItem button key="list" onClick={() => clickActivity("list")}>
            <ListItemIcon>
              <ListIcon />
            </ListItemIcon>
            <Link to="/"><ListItemText primary="List view" /></Link>
          </ListItem>
          <ListItem button key="live" onClick={() => clickActivity("live")}>
            <ListItemIcon>
              <Videocam />
            </ListItemIcon>

            <Link to="/live"><ListItemText primary="Live view (experimental)" /></Link>
          </ListItem>
        </List>
      </Drawer>
      <Login
        onSuccess={onLoginSuccess}
        open={
          loginState === "server-requires-login" ||
          loginState === "user-requested-login"
        }
        handleClose={() => {
          setLoginState((s) =>
            s === "user-requested-login" ? "not-logged-in" : s
          );
        }}
      />
      {error !== null && (
        <Container>
          <h2>Error querying server</h2>
          <pre>{error.message}</pre>
          <p>
            You may find more information in the Javascript console. Try
            reloading the page once you believe the problem is resolved.
          </p>
        </Container>
      )}
      <Routes >
        {fetchedCameras(cameras)}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
